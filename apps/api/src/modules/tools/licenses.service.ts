import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import {
  CreateLicenseDto,
  QueryLicensesDto,
  RevokeLicenseDto,
  UpdateLicenseDto,
} from './dto/license.dto';
import { License } from './entities/license.entity';
import { Tool } from './entities/tool.entity';

interface LicenseRow {
  id: string;
  license_code: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  license_type: string | null;
  employee_id: string | null;
  employee_name: string | null;
  employee_email: string | null;
  business_unit: string | null;
  unit_cost: string | null;
  currency: string | null;
  status: string;
  assigned_at: string;
  expires_at: string | null;
  notes: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ToolLicensesService {
  constructor(
    @InjectRepository(License) private readonly licensesRepo: Repository<License>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Lectura
  // -------------------------------------------------------------------------

  async findAll(query: QueryLicensesDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = Math.min(query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT, MAX_LIMIT);

    const params: unknown[] = [];
    const conditions = ['l.deleted_at IS NULL'];

    if (query.toolId) conditions.push(`l.tool_id = $${params.push(query.toolId)}`);
    if (query.employeeId) conditions.push(`l.employee_id = $${params.push(query.employeeId)}`);
    if (query.businessUnit) conditions.push(`l.business_unit = $${params.push(query.businessUnit)}`);
    if (query.status) conditions.push(`l.status = $${params.push(query.status)}`);
    if (query.currency) conditions.push(`l.currency = $${params.push(query.currency)}`);
    if (query.search) {
      const p = params.push(`%${query.search}%`);
      conditions.push(
        `(e.full_name ILIKE $${p} OR t.name ILIKE $${p} OR t.provider ILIKE $${p} OR l.license_code ILIKE $${p})`,
      );
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const from = `
      FROM tools.licenses l
      JOIN tools.tools t ON t.id = l.tool_id
      LEFT JOIN employees.employee_records e ON e.id = l.employee_id
      ${where}
    `;

    const countRows = await this.licensesRepo.query(
      `SELECT COUNT(*)::int AS total ${from}`,
      params,
    );
    const total = countRows[0]?.total ?? 0;

    const rows: LicenseRow[] = await this.licensesRepo.query(
      `
      SELECT l.id,
             l.license_code,
             l.tool_id,
             t.tool_code,
             t.name AS tool_name,
             l.license_type,
             l.employee_id,
             e.full_name AS employee_name,
             e.corporate_email AS employee_email,
             l.business_unit,
             l.unit_cost,
             l.currency,
             l.status,
             l.assigned_at,
             l.expires_at,
             l.notes
      ${from}
      ORDER BY l.license_code ASC
      LIMIT $${params.push(limit)} OFFSET $${params.push((page - 1) * limit)}
      `,
      params,
    );

    return {
      data: rows.map(toLicenseDto),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string) {
    const rows: LicenseRow[] = await this.licensesRepo.query(
      `
      SELECT l.id, l.license_code, l.tool_id, t.tool_code, t.name AS tool_name,
             l.license_type, l.employee_id, e.full_name AS employee_name,
             e.corporate_email AS employee_email, l.business_unit, l.unit_cost,
             l.currency, l.status, l.assigned_at, l.expires_at, l.notes
      FROM tools.licenses l
      JOIN tools.tools t ON t.id = l.tool_id
      LEFT JOIN employees.employee_records e ON e.id = l.employee_id
      WHERE l.id = $1 AND l.deleted_at IS NULL
      `,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Licencia ${id} no encontrada`);
    return toLicenseDto(row);
  }

  async findByTool(toolId: string) {
    const result = await this.findAll({ toolId, limit: MAX_LIMIT });
    return result.data;
  }

  async findByEmployee(employeeId: string) {
    const result = await this.findAll({ employeeId, limit: MAX_LIMIT });
    return result.data;
  }

  // -------------------------------------------------------------------------
  // Escritura
  // -------------------------------------------------------------------------

  async createLicense(dto: CreateLicenseDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const tool = await manager.findOne(Tool, {
        where: { id: dto.toolId, deletedAt: IsNull() },
      });
      if (!tool) throw new NotFoundException(`Herramienta ${dto.toolId} no encontrada`);
      if (tool.contractStatus === 'cancelado') {
        throw new BadRequestException(
          'No se puede asignar una licencia de una herramienta con el contrato cancelado.',
        );
      }

      // La unidad de negocio se copia del área del colaborador, no se lee por
      // JOIN: el costo queda imputado al área que lo autorizó aunque la persona
      // cambie de área después.
      let businessUnit = dto.businessUnit ?? null;
      if (dto.employeeId) {
        const employee = await manager.findOne(EmployeeRecord, { where: { id: dto.employeeId } });
        if (!employee) throw new NotFoundException(`Colaborador ${dto.employeeId} no encontrado`);
        if (!businessUnit) businessUnit = employee.area ?? null;
      }

      const license = manager.create(License, {
        licenseCode: await this.nextLicenseCode(manager),
        toolId: tool.id,
        employeeId: dto.employeeId ?? null,
        employeeUserId: dto.employeeUserId ?? null,
        licenseType: dto.licenseType ?? null,
        businessUnit,
        // Hereda el costo y la moneda de la herramienta cuando no se capturan.
        unitCost: dto.unitCost ?? tool.unitCost,
        currency: dto.currency ?? tool.currency,
        status: tool.requiresApproval ? 'pendiente_aprobacion' : 'activa',
        assignedAt: dto.assignedAt ?? new Date().toISOString().slice(0, 10),
        expiresAt: dto.expiresAt ?? null,
        notes: dto.notes ?? null,
        assignedBy: userId,
      });

      const saved = await manager.save(License, license);
      await this.recalculateTool(manager, tool.id);
      return this.hydrate(manager, saved.id);
    });
  }

  async updateLicense(id: string, dto: UpdateLicenseDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const license = await manager.findOne(License, { where: { id, deletedAt: IsNull() } });
      if (!license) throw new NotFoundException(`Licencia ${id} no encontrada`);

      if (dto.toolId !== undefined && dto.toolId !== license.toolId) {
        const tool = await manager.findOne(Tool, {
          where: { id: dto.toolId, deletedAt: IsNull() },
        });
        if (!tool) throw new NotFoundException(`Herramienta ${dto.toolId} no encontrada`);
      }

      // Cambiar de colaborador reimputa la unidad de negocio, salvo que venga
      // una explícita en el mismo payload.
      let businessUnit = license.businessUnit;
      if (dto.employeeId !== undefined && dto.employeeId !== license.employeeId) {
        const employee = dto.employeeId
          ? await manager.findOne(EmployeeRecord, { where: { id: dto.employeeId } })
          : null;
        if (dto.employeeId && !employee) {
          throw new NotFoundException(`Colaborador ${dto.employeeId} no encontrado`);
        }
        businessUnit = employee?.area ?? null;
      }
      if (dto.businessUnit !== undefined) businessUnit = dto.businessUnit ?? null;

      const previousToolId = license.toolId;

      Object.assign(license, {
        ...(dto.toolId !== undefined && { toolId: dto.toolId }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId ?? null }),
        ...(dto.employeeUserId !== undefined && { employeeUserId: dto.employeeUserId ?? null }),
        ...(dto.licenseType !== undefined && { licenseType: dto.licenseType ?? null }),
        ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assignedAt !== undefined && { assignedAt: dto.assignedAt }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ?? null }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
        businessUnit,
        assignedBy: license.assignedBy ?? userId,
      });

      await manager.save(License, license);

      // Si cambió de herramienta, las dos cuentas quedaron desalineadas.
      await this.recalculateTool(manager, license.toolId);
      if (previousToolId !== license.toolId) {
        await this.recalculateTool(manager, previousToolId);
      }

      return this.hydrate(manager, id);
    });
  }

  /**
   * Revocar es baja lógica, no borrado: el costo histórico de la licencia sigue
   * siendo parte del gasto del periodo en que estuvo viva.
   */
  async revokeLicense(id: string, userId: string, dto: RevokeLicenseDto) {
    return this.dataSource.transaction(async (manager) => {
      const license = await manager.findOne(License, { where: { id, deletedAt: IsNull() } });
      if (!license) throw new NotFoundException(`Licencia ${id} no encontrada`);

      license.status = 'cancelada';
      license.assignedBy = license.assignedBy ?? userId;
      if (dto.note) {
        license.notes = license.notes ? `${license.notes}\n— ${dto.note}` : dto.note;
      }
      await manager.save(License, license);
      await manager.softDelete(License, id);

      await this.recalculateTool(manager, license.toolId);
      return { id, revoked: true };
    });
  }

  // -------------------------------------------------------------------------
  // Estadísticas
  // -------------------------------------------------------------------------

  async getStats() {
    const [totals] = await this.licensesRepo.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'activa')::int AS active,
        COALESCE(SUM(unit_cost) FILTER (WHERE status = 'activa' AND currency = 'MXN'), 0)::float AS cost_mxn,
        COALESCE(SUM(unit_cost) FILTER (WHERE status = 'activa' AND currency = 'USD'), 0)::float AS cost_usd,
        COUNT(*) FILTER (
          WHERE status = 'activa'
            AND expires_at IS NOT NULL
            AND expires_at <= CURRENT_DATE + INTERVAL '30 days'
        )::int AS expiring
      FROM tools.licenses
      WHERE deleted_at IS NULL
    `);

    const byBusinessUnit = await this.licensesRepo.query(`
      SELECT COALESCE(business_unit, 'Sin área') AS unit,
             COUNT(*)::int AS count,
             COALESCE(SUM(unit_cost) FILTER (WHERE currency = 'MXN'), 0)::float AS cost_mxn,
             COALESCE(SUM(unit_cost) FILTER (WHERE currency = 'USD'), 0)::float AS cost_usd
      FROM tools.licenses
      WHERE deleted_at IS NULL AND status = 'activa'
      GROUP BY COALESCE(business_unit, 'Sin área')
      ORDER BY count DESC, unit ASC
    `);

    // Agrupa por herramienta y moneda: una misma herramienta puede tener
    // licencias en MXN y en USD, y sumarlas daría una cifra sin significado.
    const byTool = await this.licensesRepo.query(`
      SELECT t.name AS tool_name,
             t.tool_code,
             COALESCE(l.currency, t.currency) AS currency,
             COUNT(*)::int AS count,
             COALESCE(SUM(l.unit_cost), 0)::float AS total_cost
      FROM tools.licenses l
      JOIN tools.tools t ON t.id = l.tool_id
      WHERE l.deleted_at IS NULL AND l.status = 'activa'
      GROUP BY t.name, t.tool_code, COALESCE(l.currency, t.currency)
      ORDER BY total_cost DESC, t.name ASC
    `);

    return {
      totalLicenses: totals?.total ?? 0,
      activeLicenses: totals?.active ?? 0,
      totalCostMXN: round2(totals?.cost_mxn ?? 0),
      totalCostUSD: round2(totals?.cost_usd ?? 0),
      byBusinessUnit: byBusinessUnit.map((r: Record<string, unknown>) => ({
        unit: r.unit as string,
        count: r.count as number,
        costMXN: round2(r.cost_mxn as number),
        costUSD: round2(r.cost_usd as number),
      })),
      byTool: byTool.map((r: Record<string, unknown>) => ({
        toolName: r.tool_name as string,
        toolCode: r.tool_code as string,
        currency: (r.currency as string) ?? 'MXN',
        count: r.count as number,
        totalCost: round2(r.total_cost as number),
      })),
      expiringIn30Days: totals?.expiring ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  /**
   * Mantiene los denormalizados del catálogo desde las licencias vivas. Es la
   * misma regla que usa la capa de asignación: solo cuentan las 'activa' sin
   * borrar, porque una pendiente de aprobación todavía no genera cargo.
   */
  private async recalculateTool(manager: EntityManager, toolId: string) {
    await manager.query(
      `
      UPDATE tools.tools t
      SET active_assignments_count = agg.count,
          total_cost_calculated = agg.total,
          updated_at = NOW()
      FROM (
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM(COALESCE(l.unit_cost, t2.unit_cost)), 0)::numeric(14,2) AS total
        FROM tools.licenses l
        JOIN tools.tools t2 ON t2.id = l.tool_id
        WHERE l.tool_id = $1 AND l.deleted_at IS NULL AND l.status = 'activa'
      ) AS agg
      WHERE t.id = $1
      `,
      [toolId],
    );
  }

  /** Folio LIC-###. Sale de la secuencia para no reutilizar códigos ya emitidos. */
  private async nextLicenseCode(manager: EntityManager): Promise<string> {
    const rows = await manager.query(`SELECT nextval('tools.license_number_seq') AS value`);
    return `LIC-${String(Number(rows[0].value)).padStart(3, '0')}`;
  }

  private async hydrate(manager: EntityManager, id: string) {
    const rows: LicenseRow[] = await manager.query(
      `
      SELECT l.id, l.license_code, l.tool_id, t.tool_code, t.name AS tool_name,
             l.license_type, l.employee_id, e.full_name AS employee_name,
             e.corporate_email AS employee_email, l.business_unit, l.unit_cost,
             l.currency, l.status, l.assigned_at, l.expires_at, l.notes
      FROM tools.licenses l
      JOIN tools.tools t ON t.id = l.tool_id
      LEFT JOIN employees.employee_records e ON e.id = l.employee_id
      WHERE l.id = $1
      `,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Licencia ${id} no encontrada`);
    return toLicenseDto(row);
  }
}

function toLicenseDto(r: LicenseRow) {
  return {
    id: r.id,
    licenseCode: r.license_code,
    toolId: r.tool_id,
    toolCode: r.tool_code,
    toolName: r.tool_name,
    licenseType: r.license_type,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    employeeEmail: r.employee_email,
    businessUnit: r.business_unit,
    unitCost: r.unit_cost === null ? null : Number(r.unit_cost),
    currency: r.currency,
    status: r.status,
    assignedAt: typeof r.assigned_at === 'string' ? r.assigned_at : toDateString(r.assigned_at),
    expiresAt:
      r.expires_at === null
        ? null
        : typeof r.expires_at === 'string'
          ? r.expires_at
          : toDateString(r.expires_at),
    notes: r.notes,
  };
}

function toDateString(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
