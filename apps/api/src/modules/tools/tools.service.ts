import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { CatalogToolCategory } from '../catalogs/entities/catalog-tool-category.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import {
  BILLING_PERIODS_PER_YEAR,
  TOOL_BILLING_PERIODS,
  TOOL_CATEGORIES_FALLBACK,
  TOOL_CONTRACT_STATUSES,
  TOOL_CURRENCIES,
} from './constants/tools.constants';
import { AssignToolDto, RevokeAssignmentDto } from './dto/assign-tool.dto';
import { CreateToolDto } from './dto/create-tool.dto';
import { QueryToolsDto } from './dto/query-tools.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolAssignmentRecord } from './entities/tool-assignment-record.entity';
import { Tool } from './entities/tool.entity';

interface ToolAssignmentRow {
  id: string;
  employee_id: string;
  display_id: string;
  full_name: string;
  corporate_email: string | null;
  area: string | null;
  division: string | null;
  status: string;
  is_admin: boolean;
  unit_cost_override: string | null;
  notes: string | null;
  assigned_at: Date;
  revoked_at: Date | null;
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool) private readonly toolsRepo: Repository<Tool>,
    @InjectRepository(ToolAssignmentRecord)
    private readonly assignmentsRepo: Repository<ToolAssignmentRecord>,
    @InjectRepository(CatalogToolCategory)
    private readonly categoriesRepo: Repository<CatalogToolCategory>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Catálogo
  // -------------------------------------------------------------------------

  async findAll(query: QueryToolsDto) {
    const qb = this.toolsRepo
      .createQueryBuilder('t')
      .where('t.deleted_at IS NULL')
      .orderBy('t.tool_code', 'ASC');

    if (query.search) {
      qb.andWhere(
        '(t.name ILIKE :search OR t.provider ILIKE :search OR t.tool_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.contractStatus) {
      qb.andWhere('t.contract_status = :contractStatus', { contractStatus: query.contractStatus });
    }
    if (query.renewingWithinDays !== undefined && !Number.isNaN(query.renewingWithinDays)) {
      qb.andWhere('t.next_renewal_date IS NOT NULL').andWhere(
        `t.next_renewal_date <= CURRENT_DATE + (:days || ' days')::interval`,
        { days: query.renewingWithinDays },
      );
    }

    const tools = await qb.getMany();
    return tools.map((tool) => this.toDto(tool));
  }

  /**
   * Opciones del formulario. Las categorías vienen del catálogo editable; si
   * está vacío se cae a la semilla para que el alta no quede sin opciones.
   */
  async getOptions() {
    const categories = await this.listCategoryNames();
    return {
      categories: categories.length ? categories : [...TOOL_CATEGORIES_FALLBACK],
      currencies: [...TOOL_CURRENCIES],
      billingPeriods: [...TOOL_BILLING_PERIODS],
      contractStatuses: [...TOOL_CONTRACT_STATUSES],
    };
  }

  private async listCategoryNames(): Promise<string[]> {
    const rows = await this.categoriesRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return rows.map((r) => r.name);
  }

  /**
   * La categoría se valida contra el catálogo en vez de contra un @IsIn: la
   * lista es editable desde /admin/catalogos y congelarla en el DTO obligaría
   * a un deploy por cada categoría nueva. Si el catálogo está vacío se acepta
   * cualquier valor, para no bloquear el alta por una siembra pendiente.
   */
  private async assertCategory(category: string) {
    const names = await this.listCategoryNames();
    if (names.length && !names.includes(category)) {
      throw new BadRequestException(
        `Categoría "${category}" no existe en el catálogo. Opciones: ${names.join(', ')}.`,
      );
    }
  }

  async findOne(id: string) {
    const tool = await this.toolsRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);

    const assignments = await this.listAssignmentRows(id);
    return { ...this.toDto(tool), assignments };
  }

  async create(dto: CreateToolDto, userId: string) {
    await this.assertCategory(dto.category);

    return this.dataSource.transaction(async (manager) => {
      const toolCode = await this.nextToolCode(manager);

      const tool = manager.create(Tool, {
        toolCode,
        name: dto.name,
        category: dto.category,
        provider: dto.provider,
        description: dto.description ?? null,
        url: null,
        unitCost: dto.unitCost ?? 0,
        currency: dto.currency ?? 'MXN',
        billingPeriod: dto.billingPeriod,
        billingDay: dto.billingDay ?? null,
        commercialContact: dto.commercialContact ?? null,
        nextRenewalDate: dto.nextRenewalDate ?? null,
        contractStatus: dto.contractStatus ?? 'activo',
        requiresApproval: dto.requiresApproval ?? false,
        totalCostCalculated: 0,
        activeAssignmentsCount: 0,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await manager.save(Tool, tool);
      return this.toDto(saved);
    });
  }

  async update(id: string, dto: UpdateToolDto, userId: string) {
    if (dto.category !== undefined) await this.assertCategory(dto.category);

    return this.dataSource.transaction(async (manager) => {
      const tool = await manager.findOne(Tool, { where: { id, deletedAt: IsNull() } });
      if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);

      Object.assign(tool, {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.billingPeriod !== undefined && { billingPeriod: dto.billingPeriod }),
        ...(dto.billingDay !== undefined && { billingDay: dto.billingDay ?? null }),
        ...(dto.commercialContact !== undefined && {
          commercialContact: dto.commercialContact ?? null,
        }),
        ...(dto.nextRenewalDate !== undefined && { nextRenewalDate: dto.nextRenewalDate ?? null }),
        ...(dto.contractStatus !== undefined && { contractStatus: dto.contractStatus }),
        ...(dto.requiresApproval !== undefined && { requiresApproval: dto.requiresApproval }),
        updatedBy: userId,
      });

      await manager.save(Tool, tool);

      // El costo unitario entra en el total: si cambió, el acumulado que se
      // guardó en la última asignación quedó viejo.
      if (dto.unitCost !== undefined) await this.recalculate(manager, id);

      const fresh = await manager.findOneOrFail(Tool, { where: { id } });
      return this.toDto(fresh);
    });
  }

  /**
   * Baja lógica. Una herramienta con asignaciones vivas no se borra: su costo
   * sigue corriendo y borrarla dejaría el gasto sin dueño en los reportes.
   */
  async remove(id: string, userId: string) {
    const tool = await this.toolsRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!tool) throw new NotFoundException(`Herramienta ${id} no encontrada`);

    if (tool.activeAssignmentsCount > 0) {
      throw new BadRequestException(
        `La herramienta tiene ${tool.activeAssignmentsCount} asignación(es) activa(s). Revócalas antes de eliminarla.`,
      );
    }

    tool.updatedBy = userId;
    await this.toolsRepo.save(tool);
    await this.toolsRepo.softDelete(id);
    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------
  // Asignaciones
  // -------------------------------------------------------------------------

  async listAssignments(toolId: string) {
    const exists = await this.toolsRepo.findOne({
      where: { id: toolId, deletedAt: IsNull() },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Herramienta ${toolId} no encontrada`);
    return this.listAssignmentRows(toolId);
  }

  async assign(toolId: string, dto: AssignToolDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const tool = await manager.findOne(Tool, { where: { id: toolId, deletedAt: IsNull() } });
      if (!tool) throw new NotFoundException(`Herramienta ${toolId} no encontrada`);

      if (tool.contractStatus === 'cancelado') {
        throw new BadRequestException(
          'No se puede asignar una herramienta con el contrato cancelado.',
        );
      }

      const employee = await manager.findOne(EmployeeRecord, { where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException(`Colaborador ${dto.employeeId} no encontrado`);

      const live = await manager.findOne(ToolAssignmentRecord, {
        where: { toolId, employeeId: dto.employeeId, revokedAt: IsNull() },
      });
      if (live) {
        throw new BadRequestException(
          `${employee.fullName} ya tiene esta herramienta asignada.`,
        );
      }

      // requires_approval no bloquea la captura: la asignación se crea en
      // 'pendiente_aprobacion' y no cuenta para el costo hasta que se aprueba.
      const status = tool.requiresApproval ? 'pendiente_aprobacion' : 'activa';

      const assignment = manager.create(ToolAssignmentRecord, {
        toolId,
        employeeId: dto.employeeId,
        status,
        isAdmin: dto.isAdmin ?? false,
        unitCostOverride: dto.unitCostOverride ?? null,
        notes: dto.notes ?? null,
        assignedAt: new Date(),
        revokedAt: null,
        approvedBy: null,
        approvedAt: null,
        createdBy: userId,
        updatedBy: userId,
      });

      const saved = await manager.save(ToolAssignmentRecord, assignment);
      await this.recalculate(manager, toolId);
      return saved;
    });
  }

  async approve(toolId: string, assignmentId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.findOne(ToolAssignmentRecord, {
        where: { id: assignmentId, toolId },
      });
      if (!assignment) throw new NotFoundException(`Asignación ${assignmentId} no encontrada`);
      if (assignment.status !== 'pendiente_aprobacion') {
        throw new BadRequestException('La asignación no está pendiente de aprobación.');
      }

      assignment.status = 'activa';
      assignment.approvedBy = userId;
      assignment.approvedAt = new Date();
      assignment.updatedBy = userId;

      const saved = await manager.save(ToolAssignmentRecord, assignment);
      await this.recalculate(manager, toolId);
      return saved;
    });
  }

  async revoke(toolId: string, assignmentId: string, dto: RevokeAssignmentDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.findOne(ToolAssignmentRecord, {
        where: { id: assignmentId, toolId },
      });
      if (!assignment) throw new NotFoundException(`Asignación ${assignmentId} no encontrada`);
      if (assignment.revokedAt) {
        throw new BadRequestException('La asignación ya estaba revocada.');
      }

      assignment.status = 'revocada';
      assignment.revokedAt = new Date();
      assignment.updatedBy = userId;
      if (dto.notes) assignment.notes = dto.notes;

      const saved = await manager.save(ToolAssignmentRecord, assignment);
      await this.recalculate(manager, toolId);
      return saved;
    });
  }

  /** Herramientas asignadas a un colaborador — alimenta su ficha en RRHH. */
  async findByEmployee(employeeId: string) {
    const rows = await this.assignmentsRepo
      .createQueryBuilder('a')
      .innerJoin(Tool, 't', 't.id = a.tool_id')
      .select([
        'a.id AS id',
        'a.status AS status',
        'a.is_admin AS is_admin',
        'a.assigned_at AS assigned_at',
        'a.revoked_at AS revoked_at',
        'COALESCE(a.unit_cost_override, t.unit_cost) AS unit_cost',
        't.id AS tool_id',
        't.tool_code AS tool_code',
        't.name AS name',
        't.category AS category',
        't.provider AS provider',
        't.currency AS currency',
        't.billing_period AS billing_period',
      ])
      .where('a.employee_id = :employeeId', { employeeId })
      .andWhere('t.deleted_at IS NULL')
      .orderBy('a.revoked_at', 'ASC', 'NULLS FIRST')
      .addOrderBy('t.name', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      id: r.id as string,
      toolId: r.tool_id as string,
      toolCode: r.tool_code as string,
      name: r.name as string,
      category: r.category as string,
      provider: r.provider as string,
      currency: r.currency as string,
      billingPeriod: r.billing_period as string,
      unitCost: Number(r.unit_cost),
      status: r.status as string,
      isAdmin: r.is_admin as boolean,
      assignedAt: r.assigned_at as Date,
      revokedAt: r.revoked_at as Date | null,
    }));
  }

  // -------------------------------------------------------------------------
  // Estadísticas
  // -------------------------------------------------------------------------

  async getStats() {
    const tools = await this.toolsRepo.find({ where: { deletedAt: IsNull() } });

    // Las categorías del catálogo se siembran en 0 para que una recién creada
    // aparezca en el desglose aunque todavía no tenga herramientas.
    const categoryNames = await this.listCategoryNames();

    const stats = {
      total: tools.length,
      byContractStatus: {} as Record<string, number>,
      byCategory: Object.fromEntries(categoryNames.map((n) => [n, 0])) as Record<string, number>,
      activeAssignments: 0,
      // Gasto anualizado por moneda: sumar MXN y USD en un solo número exigiría
      // un tipo de cambio que el módulo no tiene, y daría una cifra falsa.
      annualCostByCurrency: {} as Record<string, number>,
      monthlyCostByCurrency: {} as Record<string, number>,
      renewingIn30Days: 0,
    };

    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);

    for (const tool of tools) {
      stats.byContractStatus[tool.contractStatus] =
        (stats.byContractStatus[tool.contractStatus] ?? 0) + 1;
      stats.byCategory[tool.category] = (stats.byCategory[tool.category] ?? 0) + 1;
      stats.activeAssignments += tool.activeAssignmentsCount;

      if (tool.contractStatus === 'cancelado') continue;

      const perYear = BILLING_PERIODS_PER_YEAR[tool.billingPeriod] ?? 0;
      const annual = tool.totalCostCalculated * perYear;
      stats.annualCostByCurrency[tool.currency] =
        (stats.annualCostByCurrency[tool.currency] ?? 0) + annual;
      stats.monthlyCostByCurrency[tool.currency] =
        (stats.monthlyCostByCurrency[tool.currency] ?? 0) + annual / 12;

      if (tool.nextRenewalDate && new Date(tool.nextRenewalDate) <= in30) {
        stats.renewingIn30Days += 1;
      }
    }

    for (const currency of Object.keys(stats.annualCostByCurrency)) {
      stats.annualCostByCurrency[currency] = round2(stats.annualCostByCurrency[currency] ?? 0);
      stats.monthlyCostByCurrency[currency] = round2(stats.monthlyCostByCurrency[currency] ?? 0);
    }

    return stats;
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  /**
   * Recalcula los denormalizados del catálogo desde las asignaciones.
   *
   * Cuenta solo las 'activa' sin revocar: una pendiente de aprobación todavía
   * no genera cargo, y una revocada dejó de generarlo. El costo usa el override
   * cuando existe, porque ahí es donde vive el precio real de esa licencia.
   */
  private async recalculate(manager: EntityManager, toolId: string) {
    await manager.query(
      `
      UPDATE tools.tools t
      SET active_assignments_count = agg.count,
          total_cost_calculated = agg.total,
          updated_at = NOW()
      FROM (
        SELECT
          COUNT(*)::int AS count,
          COALESCE(SUM(COALESCE(a.unit_cost_override, t2.unit_cost)), 0)::numeric(14,2) AS total
        FROM tools.tool_assignments a
        JOIN tools.tools t2 ON t2.id = a.tool_id
        WHERE a.tool_id = $1
          AND a.revoked_at IS NULL
          AND a.status = 'activa'
      ) AS agg
      WHERE t.id = $1
      `,
      [toolId],
    );
  }

  /**
   * Siguiente folio HTA-###. Sale de la secuencia y no de un COUNT: al borrar
   * una herramienta el conteo reutilizaría un código ya impreso en reportes.
   */
  private async nextToolCode(manager: EntityManager): Promise<string> {
    const rows = await manager.query(`SELECT nextval('tools.tool_number_seq') AS value`);
    const value = Number(rows[0].value);
    return `HTA-${String(value).padStart(3, '0')}`;
  }

  private async listAssignmentRows(toolId: string) {
    const rows: ToolAssignmentRow[] = await this.assignmentsRepo.query(
      `
      SELECT a.id,
             a.employee_id,
             e.display_id,
             e.full_name,
             e.corporate_email,
             e.area,
             e.division,
             a.status,
             a.is_admin,
             a.unit_cost_override,
             a.notes,
             a.assigned_at,
             a.revoked_at
      FROM tools.tool_assignments a
      JOIN employees.employee_records e ON e.id = a.employee_id
      WHERE a.tool_id = $1
      ORDER BY a.revoked_at ASC NULLS FIRST, e.full_name ASC
      `,
      [toolId],
    );

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      displayId: r.display_id,
      fullName: r.full_name,
      corporateEmail: r.corporate_email,
      area: r.area,
      division: r.division,
      status: r.status,
      isAdmin: r.is_admin,
      unitCostOverride: r.unit_cost_override === null ? null : Number(r.unit_cost_override),
      notes: r.notes,
      assignedAt: r.assigned_at,
      revokedAt: r.revoked_at,
    }));
  }

  /**
   * Costo anualizado de la herramienta: lo calcula el API para que la tabla, el
   * detalle y los reportes no repitan (y desincronicen) la misma fórmula.
   */
  private toDto(tool: Tool) {
    const perYear = BILLING_PERIODS_PER_YEAR[tool.billingPeriod] ?? 0;
    const annualCost = round2(tool.totalCostCalculated * perYear);

    return {
      id: tool.id,
      toolCode: tool.toolCode,
      name: tool.name,
      category: tool.category,
      provider: tool.provider,
      description: tool.description,
      unitCost: tool.unitCost,
      currency: tool.currency,
      billingPeriod: tool.billingPeriod,
      billingDay: tool.billingDay,
      commercialContact: tool.commercialContact,
      nextRenewalDate: tool.nextRenewalDate,
      contractStatus: tool.contractStatus,
      requiresApproval: tool.requiresApproval,
      totalCostCalculated: tool.totalCostCalculated,
      activeAssignmentsCount: tool.activeAssignmentsCount,
      annualCost,
      monthlyCost: round2(annualCost / 12),
      createdAt: tool.createdAt,
      updatedAt: tool.updatedAt,
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
