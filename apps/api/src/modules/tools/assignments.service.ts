import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { NotificationFlowsService } from '../notifications/notification-flows.service';
import { UNUSED_CRITICAL_DAYS } from './constants/tools.constants';
import {
  CreateAssignerDto,
  CreateAssignmentDto,
  QueryAssignmentsDto,
  RevokeAssignmentDto,
} from './dto/assignment.dto';
import { Assigner } from './entities/assigner.entity';
import { Assignment } from './entities/assignment.entity';
import { Tool } from './entities/tool.entity';

interface AssignmentRow {
  id: string;
  assignment_code: string;
  status: string;
  assignment_date: string;
  revocation_date: string | null;
  last_used_date: string | null;
  dias_sin_uso: string | null;
  notes: string | null;
  revocation_reason: string | null;
  assigned_by_id: string | null;
  assigned_by_name: string | null;
  employee_id: string;
  employee_name: string;
  employee_area: string | null;
  employee_position: string | null;
  employee_email: string | null;
  tool_id: string;
  tool_name: string;
  tool_code: string;
  tool_category: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @InjectRepository(Assignment) private readonly assignmentsRepo: Repository<Assignment>,
    @InjectRepository(Assigner) private readonly assignersRepo: Repository<Assigner>,
    private readonly dataSource: DataSource,
    private readonly flowsService: NotificationFlowsService,
  ) {}

  // -------------------------------------------------------------------------
  // Lectura
  // -------------------------------------------------------------------------

  /**
   * Paginación por cursor sobre assignment_code: es único y monótono, así que
   * no se salta ni repite filas cuando se asigna algo mientras alguien pagina,
   * cosa que OFFSET sí hace.
   */
  async getAssignments(query: QueryAssignmentsDto) {
    const limit = Math.min(query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT, MAX_LIMIT);

    const params: unknown[] = [];
    const conditions = ['a.deleted_at IS NULL'];

    if (query.toolId) conditions.push(`a.tool_id = $${params.push(query.toolId)}`);
    if (query.employeeId) conditions.push(`a.employee_id = $${params.push(query.employeeId)}`);
    if (query.assignedById) conditions.push(`a.assigned_by_id = $${params.push(query.assignedById)}`);
    if (query.status) conditions.push(`a.status = $${params.push(query.status)}`);
    if (query.search) {
      const p = params.push(`%${query.search}%`);
      conditions.push(
        `(e.full_name ILIKE $${p} OR t.name ILIKE $${p} OR a.assignment_code ILIKE $${p})`,
      );
    }
    if (query.cursor) conditions.push(`a.assignment_code < $${params.push(query.cursor)}`);

    const rows: AssignmentRow[] = await this.assignmentsRepo.query(
      `
      SELECT a.id,
             a.assignment_code,
             a.status,
             a.assignment_date,
             a.revocation_date,
             a.last_used_date,
             CASE WHEN a.last_used_date IS NULL THEN NULL
                  ELSE DATE_PART('day', NOW() - a.last_used_date)
             END AS dias_sin_uso,
             a.notes,
             a.revocation_reason,
             a.assigned_by_id,
             a.assigned_by_name,
             a.employee_id,
             e.full_name AS employee_name,
             e.area AS employee_area,
             e.position AS employee_position,
             e.corporate_email AS employee_email,
             a.tool_id,
             t.name AS tool_name,
             t.tool_code,
             t.category AS tool_category
      FROM tools.assignments a
      JOIN tools.tools t ON t.id = a.tool_id
      JOIN employees.employee_records e ON e.id = a.employee_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.assignment_code DESC
      LIMIT $${params.push(limit + 1)}
      `,
      params,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: page.map(toAssignmentDto),
      nextCursor: hasMore ? (page[page.length - 1]?.assignment_code ?? null) : null,
    };
  }

  async getAssignment(id: string) {
    const rows: AssignmentRow[] = await this.assignmentsRepo.query(
      `
      SELECT a.id, a.assignment_code, a.status, a.assignment_date, a.revocation_date,
             a.last_used_date,
             CASE WHEN a.last_used_date IS NULL THEN NULL
                  ELSE DATE_PART('day', NOW() - a.last_used_date) END AS dias_sin_uso,
             a.notes, a.revocation_reason, a.assigned_by_id, a.assigned_by_name,
             a.employee_id, e.full_name AS employee_name, e.area AS employee_area,
             e.position AS employee_position, e.corporate_email AS employee_email,
             a.tool_id, t.name AS tool_name, t.tool_code, t.category AS tool_category
      FROM tools.assignments a
      JOIN tools.tools t ON t.id = a.tool_id
      JOIN employees.employee_records e ON e.id = a.employee_id
      WHERE a.id = $1 AND a.deleted_at IS NULL
      `,
      [id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException(`Asignación ${id} no encontrada`);
    return toAssignmentDto(row);
  }

  /**
   * Asignaciones de un colaborador, activas primero. Alimenta la pestaña
   * "Equipos y Licencias" del expediente de RRHH, que antes leía del Maestro
   * de Licenciamientos.
   */
  async getByEmployee(employeeId: string) {
    const result = await this.getAssignments({ employeeId, limit: MAX_LIMIT });
    return result.data;
  }

  // -------------------------------------------------------------------------
  // Escritura
  // -------------------------------------------------------------------------

  async createAssignment(dto: CreateAssignmentDto, userId: string) {
    const created = await this.dataSource.transaction(async (manager) => {
      const tool = await manager.findOne(Tool, {
        where: { id: dto.toolId, deletedAt: IsNull() },
      });
      if (!tool) throw new NotFoundException(`Herramienta ${dto.toolId} no encontrada`);
      if (tool.contractStatus === 'cancelado') {
        throw new BadRequestException(
          'No se puede asignar una herramienta con el contrato cancelado.',
        );
      }

      const employee = await manager.findOne(EmployeeRecord, { where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException(`Colaborador ${dto.employeeId} no encontrado`);

      // El índice único parcial ya lo impide, pero un 500 por violación de
      // constraint no le dice nada al usuario.
      const live = await manager.findOne(Assignment, {
        where: {
          toolId: dto.toolId,
          employeeId: dto.employeeId,
          revocationDate: IsNull(),
          deletedAt: IsNull(),
        },
      });
      if (live) {
        throw new BadRequestException(
          `${employee.fullName} ya tiene ${tool.name} asignada (${live.assignmentCode}).`,
        );
      }

      // El asignador sale del catálogo; el nombre se congela en la fila.
      const assigner = dto.assignedById
        ? await manager.findOne(Assigner, { where: { id: dto.assignedById, isActive: true } })
        : await manager.findOne(Assigner, { where: { userId, isActive: true } });
      if (dto.assignedById && !assigner) {
        throw new BadRequestException('El asignador seleccionado no está en el catálogo activo.');
      }

      const assignment = manager.create(Assignment, {
        assignmentCode: await this.nextAssignmentCode(manager),
        toolId: tool.id,
        employeeId: employee.id,
        assignedById: assigner?.userId ?? userId,
        assignedByName: assigner?.displayName ?? null,
        assignmentDate: dto.assignmentDate ?? todayISO(),
        revocationDate: null,
        lastUsedDate: dto.lastUsedDate ?? null,
        status: 'activo',
        notes: dto.notes ?? null,
        revocationReason: null,
      });

      const saved = await manager.save(Assignment, assignment);
      await this.recalculateTool(manager, tool.id);
      return { id: saved.id, tool, employee, code: saved.assignmentCode };
    });

    // Fuera de la transacción: una notificación caída no debe revertir la
    // asignación, que ya es un hecho.
    if (created.tool.requiresApproval) {
      try {
        await this.flowsService.notify('transformacion', 'asignacion_requiere_aprobacion', {
          requesterId: userId,
          actorId: userId,
          entityId: created.id,
          entityType: 'tool_assignment',
          title: `Asignación ${created.code} requiere aprobación`,
          message: `${created.employee.fullName} recibió ${created.tool.name} (${created.tool.toolCode}), marcada como "requiere aprobación".`,
          actionUrl: `/transformacion/asignaciones?search=${created.code}`,
        });
      } catch (err) {
        this.logger.warn(
          `No se pudo notificar la asignación ${created.code}: ${(err as Error).message}`,
        );
      }
    }

    return this.getAssignment(created.id);
  }

  async revokeAssignment(id: string, userId: string, dto: RevokeAssignmentDto) {
    await this.dataSource.transaction(async (manager) => {
      const assignment = await manager.findOne(Assignment, {
        where: { id, deletedAt: IsNull() },
      });
      if (!assignment) throw new NotFoundException(`Asignación ${id} no encontrada`);
      if (assignment.revocationDate) {
        throw new BadRequestException('La asignación ya estaba revocada.');
      }

      assignment.status = 'revocado';
      assignment.revocationDate = todayISO();
      assignment.revocationReason = dto.reason ?? null;
      await manager.save(Assignment, assignment);

      await this.recalculateTool(manager, assignment.toolId);
    });

    this.logger.log(`Asignación ${id} revocada por ${userId}`);
    return this.getAssignment(id);
  }

  async updateLastUsed(id: string, date: string) {
    const assignment = await this.assignmentsRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!assignment) throw new NotFoundException(`Asignación ${id} no encontrada`);

    assignment.lastUsedDate = date;
    await this.assignmentsRepo.save(assignment);
    return this.getAssignment(id);
  }

  // -------------------------------------------------------------------------
  // Estadísticas
  // -------------------------------------------------------------------------

  async getStats() {
    const [totals] = await this.assignmentsRepo.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'activo')::int AS total_active,
        COUNT(*) FILTER (WHERE status = 'revocado')::int AS total_revoked,
        COUNT(*) FILTER (
          WHERE status = 'activo'
            AND (last_used_date IS NULL OR last_used_date < CURRENT_DATE - $1::int)
        )::int AS unused
      FROM tools.assignments
      WHERE deleted_at IS NULL
      `,
      [UNUSED_CRITICAL_DAYS],
    );

    const byTool = await this.assignmentsRepo.query(`
      SELECT t.tool_code, t.name AS tool_name, COUNT(*)::int AS active_count
      FROM tools.assignments a
      JOIN tools.tools t ON t.id = a.tool_id
      WHERE a.deleted_at IS NULL AND a.status = 'activo'
      GROUP BY t.tool_code, t.name
      ORDER BY active_count DESC, t.name ASC
    `);

    const byArea = await this.assignmentsRepo.query(`
      SELECT COALESCE(e.area, 'Sin área') AS area, COUNT(*)::int AS active_count
      FROM tools.assignments a
      JOIN employees.employee_records e ON e.id = a.employee_id
      WHERE a.deleted_at IS NULL AND a.status = 'activo'
      GROUP BY COALESCE(e.area, 'Sin área')
      ORDER BY active_count DESC, area ASC
    `);

    const recent = await this.getAssignments({ limit: 5 });

    return {
      totalActive: totals?.total_active ?? 0,
      totalRevoked: totals?.total_revoked ?? 0,
      unusedOver60Days: totals?.unused ?? 0,
      byTool: byTool.map((r: Record<string, unknown>) => ({
        toolCode: r.tool_code as string,
        toolName: r.tool_name as string,
        activeCount: r.active_count as number,
      })),
      byArea: byArea.map((r: Record<string, unknown>) => ({
        area: r.area as string,
        activeCount: r.active_count as number,
      })),
      recentAssignments: recent.data,
    };
  }

  // -------------------------------------------------------------------------
  // Catálogo de asignadores
  // -------------------------------------------------------------------------

  getAssigners() {
    return this.assignersRepo.find({
      where: { isActive: true },
      order: { displayName: 'ASC' },
    });
  }

  async addAssigner(dto: CreateAssignerDto) {
    if (!dto.userId && !dto.employeeId) {
      throw new BadRequestException('Indica el usuario o el colaborador a agregar.');
    }

    const [employee] = dto.employeeId
      ? await this.assignersRepo.query(
          `SELECT id, full_name, corporate_email FROM employees.employee_records WHERE id = $1`,
          [dto.employeeId],
        )
      : [null];
    if (dto.employeeId && !employee) {
      throw new NotFoundException(`Colaborador ${dto.employeeId} no encontrado`);
    }

    // El catálogo referencia auth.users. Si solo llegó el expediente, se
    // resuelve por correo corporativo, que es como se vinculan en el resto del
    // sistema.
    const [user] = dto.userId
      ? await this.assignersRepo.query(
          `SELECT id, name, email FROM auth.users WHERE id = $1 AND deleted_at IS NULL`,
          [dto.userId],
        )
      : await this.assignersRepo.query(
          `SELECT id, name, email FROM auth.users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
          [employee?.corporate_email ?? ''],
        );

    if (!user) {
      throw new BadRequestException(
        employee
          ? `${employee.full_name} no tiene usuario de la plataforma vinculado a ${employee.corporate_email ?? 'su correo'}; no puede quedar como asignador.`
          : `Usuario ${dto.userId} no encontrado`,
      );
    }

    // Reactivar en lugar de duplicar: user_id es único, así que un alta sobre
    // alguien removido antes reventaría con un 500 de constraint.
    const existing = await this.assignersRepo.findOne({ where: { userId: user.id } });
    if (existing) {
      existing.isActive = true;
      if (dto.displayName) existing.displayName = dto.displayName;
      if (employee) existing.employeeId = employee.id;
      return this.assignersRepo.save(existing);
    }

    return this.assignersRepo.save(
      this.assignersRepo.create({
        userId: user.id,
        employeeId: employee?.id ?? null,
        displayName: dto.displayName ?? employee?.full_name ?? user.name ?? user.email,
        isActive: true,
      }),
    );
  }

  /** Baja lógica: el snapshot de las asignaciones ya emitidas no se toca. */
  async removeAssigner(id: string) {
    const assigner = await this.assignersRepo.findOne({ where: { id } });
    if (!assigner) throw new NotFoundException(`Asignador ${id} no encontrado`);

    assigner.isActive = false;
    await this.assignersRepo.save(assigner);
    return { id, removed: true };
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  private async recalculateTool(manager: EntityManager, toolId: string) {
    await manager.query(
      `
      UPDATE tools.tools t
      SET active_assignments_count = agg.count,
          total_cost_calculated = (t.unit_cost * agg.count)::numeric(14,2),
          updated_at = NOW()
      FROM (
        SELECT COUNT(*)::int AS count
        FROM tools.assignments a
        WHERE a.tool_id = $1 AND a.deleted_at IS NULL AND a.status = 'activo'
      ) AS agg
      WHERE t.id = $1
      `,
      [toolId],
    );
  }

  /** Folio ASG-000001. Sale de la secuencia para no reutilizar códigos emitidos. */
  private async nextAssignmentCode(manager: EntityManager): Promise<string> {
    const rows = await manager.query(`SELECT nextval('tools.assignment_number_seq') AS value`);
    return `ASG-${String(Number(rows[0].value)).padStart(6, '0')}`;
  }
}

function toAssignmentDto(r: AssignmentRow) {
  return {
    id: r.id,
    assignmentCode: r.assignment_code,
    status: r.status,
    assignmentDate: toDateString(r.assignment_date),
    revocationDate: r.revocation_date === null ? null : toDateString(r.revocation_date),
    lastUsedDate: r.last_used_date === null ? null : toDateString(r.last_used_date),
    diasSinUso: r.dias_sin_uso === null ? null : Number(r.dias_sin_uso),
    notes: r.notes,
    revocationReason: r.revocation_reason,
    assignedById: r.assigned_by_id,
    assignedByName: r.assigned_by_name,
    employee: {
      id: r.employee_id,
      fullName: r.employee_name,
      area: r.employee_area,
      position: r.employee_position,
      // La foto se sirve por correo corporativo, igual que en el resto del
      // sistema; no hay columna photo_url en el expediente.
      photoUrl: r.employee_email ? `/api/users/${encodeURIComponent(r.employee_email)}/photo` : null,
    },
    tool: {
      id: r.tool_id,
      name: r.tool_name,
      toolCode: r.tool_code,
      category: r.tool_category,
    },
  };
}

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    // Fecha local, no toISOString(): ese convierte a UTC y en México corre la
    // fecha un día hacia atrás.
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
