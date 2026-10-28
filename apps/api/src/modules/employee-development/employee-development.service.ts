import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { userHasPermission } from '../auth/permissions.util';
import { OKR_SCORE_VISIBLE_TO_EMPLOYEE, visibleEvaluation, type EvaluationFields, type Viewer } from '../okr-evaluations/okr-evaluations.util';
import {
  EMPLOYEE_NOT_FOUND,
  KPI_NOT_FOUND,
  NO_POSITION_MESSAGE,
  OKR_NOT_FOUND,
  POSITION_NOT_FOUND,
  addSummaries,
  assertPeriod,
  canViewEmployeeDevelopment,
  type AccessFacts,
  currentPeriodMx,
  findSuggestion,
  summarize,
  sumWeights,
  toKpiView,
  toOkrView,
  toPositionSummary,
  visibleDescription,
  type AssignmentSummary,
  type BulkAssignmentSummary,
  type DevelopmentView,
  type PositionSummary,
} from './employee-development.util';

export interface Actor {
  id?: string;
  email?: string;
  name?: string;
}

interface EmployeeRow {
  id: string;
  position: string | null;
  job_position_id: string | null;
  full_name: string;
  auth_user_id: string | null;
  direct_report_to_id: string | null;
}

type Q = { query: DataSource['query'] };

/** El UPDATE ... RETURNING de TypeORM llega como [filas, afectadas]; esto lee la primera fila en ambos casos. */
function firstRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result)) return undefined;
  const head = result[0];
  return (Array.isArray(head) ? head[0] : head) as T | undefined;
}

/**
 * Desarrollo Organizacional del colaborador (RRHH 2.0 · M5): puesto vinculado,
 * descripción y OKRs/KPIs copiados (snapshot) desde la Matriz de Puestos.
 *
 * DECISIONES PROVISIONALES (el RFP no las define): vínculo manual con
 * `employee_records.job_position_id` y copia de texto y peso que no se actualiza
 * sola. El interceptor global no cubre estas rutas (segmento `hr`), así que la
 * auditoría es explícita.
 */
@Injectable()
export class EmployeeDevelopmentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ── Regla de acceso por empleado (reutilizable: el M7 la usará) ────────────

  /**
   * Puede ver el desarrollo de un empleado: quien tenga `read`, el propio
   * empleado o su líder DIRECTO. Cualquier otro caso: 404 (no se revela que existe).
   */
  async assertCanView(user: Pick<User, 'id' | 'roles' | 'userPermissions'>, employeeId: string): Promise<void> {
    await this.resolveAccess(user, employeeId);
  }

  /** Igual que `assertCanView`, pero devuelve los hechos de acceso (permiso, propio, líder directo) para quien los necesite (M7). */
  async resolveAccess(user: Pick<User, 'id' | 'roles' | 'userPermissions'>, employeeId: string): Promise<AccessFacts> {
    const rows = (await this.dataSource.query(
      `SELECT e.id, e.auth_user_id, e.direct_report_to_id,
              (SELECT m.id FROM employees.employee_records m WHERE m.auth_user_id = $2 AND m.deleted_at IS NULL LIMIT 1) AS viewer_employee_id
       FROM employees.employee_records e WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [employeeId, user.id],
    )) as { id: string; auth_user_id: string | null; direct_report_to_id: string | null; viewer_employee_id: string | null }[];
    const e = rows[0];
    const facts: AccessFacts | null = e
      ? {
          hasReadPermission: userHasPermission(user, 'rrhh', 'desarrollo-organizacional', 'read'),
          isSelf: e.auth_user_id !== null && e.auth_user_id === user.id,
          isDirectLeader: e.viewer_employee_id !== null && e.direct_report_to_id === e.viewer_employee_id && e.id !== e.viewer_employee_id,
        }
      : null;
    if (!facts || !canViewEmployeeDevelopment(facts)) throw new NotFoundException(EMPLOYEE_NOT_FOUND);
    return facts;
  }

  // ── Lectura ────────────────────────────────────────────────────────────────

  async getForUser(user: Pick<User, 'id' | 'roles' | 'userPermissions'>, employeeId: string, period?: string): Promise<DevelopmentView> {
    const facts = await this.resolveAccess(user, employeeId);
    // El propio colaborador siempre recibe la vista restringida, aunque además tenga permiso de RRHH.
    const viewer: Viewer = facts.isSelf ? 'self' : facts.hasReadPermission ? 'rrhh' : 'leader';
    return this.getDevelopment(employeeId, period, viewer);
  }

  /** Lectura sin verificar acceso: quien llama ya resolvió que el empleado es el correcto (p. ej. Mi Información). */
  async getDevelopment(employeeId: string, period?: string, viewer: Viewer = 'self'): Promise<DevelopmentView> {
    const chosen = period ?? currentPeriodMx();
    assertPeriod(chosen);

    const emp = await this.loadEmployee(this.dataSource, employeeId);
    const position = emp.job_position_id
      ? (
          (await this.dataSource.query(
            `SELECT id, code, title, area, level, description, description_approved
             FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL`,
            [emp.job_position_id],
          )) as { id: string; code: string; title: string; area: string; level: string | null; description: string | null; description_approved: boolean }[]
        )[0]
      : undefined;

    let suggested: PositionSummary | null = null;
    if (!position) {
      const candidates = (await this.dataSource.query(
        `SELECT id, code, title, area, level FROM hr.job_positions WHERE deleted_at IS NULL AND status = 'activo'`,
      )) as { id: string; code: string; title: string; area: string; level: string | null }[];
      const hit = findSuggestion(emp.position, candidates);
      suggested = hit ? toPositionSummary(hit) : null;
    }

    const [okrRows, kpiRows, periodRows] = await Promise.all([
      this.dataSource.query(
        `SELECT id, objective_code, kr_code, objective, key_result, weight FROM hr.employee_okrs
         WHERE employee_id = $1 AND period = $2 AND deleted_at IS NULL AND is_active = true
         ORDER BY sort_order ASC, created_at ASC`,
        [employeeId, chosen],
      ) as Promise<{ id: string; objective_code: string | null; kr_code: string | null; objective: string; key_result: string; weight: string | null }[]>,
      this.dataSource.query(
        `SELECT id, name, description, target_value, measurement_frequency FROM hr.employee_kpis
         WHERE employee_id = $1 AND deleted_at IS NULL AND is_active = true ORDER BY created_at ASC`,
        [employeeId],
      ) as Promise<{ id: string; name: string; description: string | null; target_value: string | null; measurement_frequency: string | null }[]>,
      this.dataSource.query(
        `SELECT DISTINCT period FROM hr.employee_okrs
         WHERE employee_id = $1 AND deleted_at IS NULL AND is_active = true ORDER BY period DESC`,
        [employeeId],
      ) as Promise<{ period: string }[]>,
    ]);

    // M7: la evaluación solo viaja a quien corresponde (RRHH y líder directo: todo; el propio colaborador: nada,
    // o solo la calificación si la bandera está encendida). Una consulta para todos los OKRs: sin N+1.
    const wantsEvaluations = viewer !== 'self' || OKR_SCORE_VISIBLE_TO_EMPLOYEE;
    const evaluations = new Map<string, EvaluationFields>();
    if (wantsEvaluations && okrRows.length > 0) {
      const evRows = (await this.dataSource.query(
        `SELECT employee_okr_id, score, status, comments FROM hr.okr_evaluations
         WHERE employee_id = $1 AND period = $2 AND deleted_at IS NULL`,
        [employeeId, chosen],
      )) as { employee_okr_id: string; score: string | null; status: 'pendiente' | 'completada'; comments: string | null }[];
      for (const r of evRows) {
        evaluations.set(r.employee_okr_id, { score: r.score === null ? null : Number(r.score), status: r.status, comments: r.comments });
      }
    }
    const okrs = okrRows.map((r) => ({ ...toOkrView(r), ...visibleEvaluation(viewer, evaluations.get(r.id) ?? null) }));
    const description = position ? visibleDescription(position.description, position.description_approved) : null;
    return {
      employeeId,
      position: position ? toPositionSummary(position) : null,
      description,
      descriptionPending: !!position && description === null,
      suggestedPosition: suggested,
      period: chosen,
      periodsWithData: periodRows.map((p) => p.period),
      okrs,
      weightSum: sumWeights(okrs),
      kpis: kpiRows.map(toKpiView),
    };
  }

  /** Puestos disponibles para vincular: solo datos mínimos (nunca descripciones). */
  async positionOptions(): Promise<(PositionSummary & { status?: never })[]> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, title, area, level FROM hr.job_positions
       WHERE deleted_at IS NULL AND status <> 'inactivo' ORDER BY title ASC`,
    )) as { id: string; code: string; title: string; area: string; level: string | null }[];
    return rows.map(toPositionSummary);
  }

  // ── Escritura (siempre con `write`, que exige el controlador) ──────────────

  private async loadEmployee(m: Q, employeeId: string, lock = false): Promise<EmployeeRow> {
    const rows = (await m.query(
      `SELECT id, position, job_position_id, full_name, auth_user_id, direct_report_to_id
       FROM employees.employee_records WHERE id = $1 AND deleted_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
      [employeeId],
    )) as EmployeeRow[];
    if (!rows[0]) throw new NotFoundException(EMPLOYEE_NOT_FOUND);
    return rows[0];
  }

  /**
   * Vincula o desvincula (null) el puesto. Solo puestos no inactivos y no
   * eliminados. Cambiar de puesto NO borra lo ya asignado: queda como historial
   * con su puesto de origen.
   */
  async setPosition(employeeId: string, jobPositionId: string | null, actor: Actor): Promise<DevelopmentView> {
    const change = await this.dataSource.transaction(async (m) => {
      const emp = await this.loadEmployee(m, employeeId, true);
      let to: { id: string; code: string } | null = null;
      if (jobPositionId) {
        const rows = (await m.query(
          `SELECT id, code FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL AND status <> 'inactivo'`,
          [jobPositionId],
        )) as { id: string; code: string }[];
        if (!rows[0]) throw new BadRequestException('El puesto no está disponible en la Matriz de Puestos');
        to = rows[0];
      }
      const from = emp.job_position_id
        ? (((await m.query(`SELECT id, code FROM hr.job_positions WHERE id = $1`, [emp.job_position_id])) as { id: string; code: string }[])[0] ?? null)
        : null;
      await m.query(`UPDATE employees.employee_records SET job_position_id = $2 WHERE id = $1`, [employeeId, jobPositionId]);
      return { emp, from, to };
    });
    await this.log('link-position', actor, 'employee', employeeId, change.emp.full_name, {
      position: { from: change.from?.code ?? null, to: change.to?.code ?? null },
    });
    return this.getDevelopment(employeeId);
  }

  /**
   * Copia (snapshot) los OKRs activos del puesto cuyo periodo sea el elegido o NULL (plantilla: vale
   * para cualquier semestre) y los KPIs activos del puesto vinculado; la copia lleva el periodo elegido
   * y los códigos de objetivo/KR. Idempotente: lo ya copiado se omite (índice único parcial por
   * origen). Una sola sentencia INSERT … SELECT por tipo.
   */
  private async copyForEmployee(m: Q, employeeId: string, jobPositionId: string, period: string, actorId: string | null): Promise<AssignmentSummary> {
    const okrTotal = Number(
      ((await m.query(
        `SELECT COUNT(*) AS n FROM hr.job_position_okrs WHERE job_position_id = $1 AND (period = $2 OR period IS NULL) AND deleted_at IS NULL AND is_active = true`,
        [jobPositionId, period],
      )) as { n: string }[])[0]?.n ?? 0,
    );
    const okrCopied = (
      (await m.query(
        `INSERT INTO hr.employee_okrs (employee_id, job_position_id, job_position_okr_id, period, objective_code, kr_code, objective, key_result, weight, sort_order, created_by)
         SELECT $1, o.job_position_id, o.id, $3::varchar, o.objective_code, o.kr_code, o.objective, o.key_result, o.weight, o.sort_order, $4
         FROM hr.job_position_okrs o
         WHERE o.job_position_id = $2 AND (o.period = $3 OR o.period IS NULL) AND o.deleted_at IS NULL AND o.is_active = true
         ON CONFLICT (employee_id, job_position_okr_id, period) WHERE deleted_at IS NULL AND job_position_okr_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [employeeId, jobPositionId, period, actorId],
      )) as unknown[]
    ).length;

    const kpiTotal = Number(
      ((await m.query(
        `SELECT COUNT(*) AS n FROM hr.job_position_kpis WHERE job_position_id = $1 AND deleted_at IS NULL AND is_active = true`,
        [jobPositionId],
      )) as { n: string }[])[0]?.n ?? 0,
    );
    const kpiCopied = (
      (await m.query(
        `INSERT INTO hr.employee_kpis (employee_id, job_position_id, job_position_kpi_id, name, description, target_value, measurement_frequency, created_by)
         SELECT $1, k.job_position_id, k.id, k.name, k.description, k.target_value, k.measurement_frequency, $3
         FROM hr.job_position_kpis k
         WHERE k.job_position_id = $2 AND k.deleted_at IS NULL AND k.is_active = true
         ON CONFLICT (employee_id, job_position_kpi_id) WHERE deleted_at IS NULL AND job_position_kpi_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [employeeId, jobPositionId, actorId],
      )) as unknown[]
    ).length;

    return summarize(okrTotal, okrCopied, kpiTotal, kpiCopied);
  }

  /** Asignación individual. Sin puesto vinculado: 409 con mensaje claro. */
  async assign(employeeId: string, period: string, actor: Actor): Promise<{ summary: AssignmentSummary; development: DevelopmentView }> {
    assertPeriod(period);
    const { summary, emp } = await this.dataSource.transaction(async (m) => {
      const emp = await this.loadEmployee(m, employeeId, true);
      if (!emp.job_position_id) throw new ConflictException(NO_POSITION_MESSAGE);
      return { summary: await this.copyForEmployee(m, employeeId, emp.job_position_id, period, actor.id ?? null), emp };
    });
    await this.log('assign', actor, 'employee', employeeId, emp.full_name, { period, ...summary });
    return { summary, development: await this.getDevelopment(employeeId, period) };
  }

  /**
   * Asignación masiva desde la Matriz: a todos los empleados ACTIVOS con ese
   * puesto, con la misma lógica idempotente (reutiliza `copyForEmployee`).
   * Exige `matriz-puestos.update` (lo valida el controlador) Y
   * `desarrollo-organizacional.write` (se valida aquí).
   */
  async assignToPositionEmployees(
    user: Pick<User, 'id' | 'roles' | 'userPermissions'>,
    jobPositionId: string,
    period: string,
    actor: Actor,
  ): Promise<BulkAssignmentSummary> {
    if (!userHasPermission(user, 'rrhh', 'desarrollo-organizacional', 'write')) {
      throw new ForbiddenException('No tienes permisos para asignar OKRs y KPIs a colaboradores');
    }
    assertPeriod(period);
    const { summary, position } = await this.dataSource.transaction(async (m) => {
      const positions = (await m.query(
        `SELECT id, code, title FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL`,
        [jobPositionId],
      )) as { id: string; code: string; title: string }[];
      if (!positions[0]) throw new NotFoundException(POSITION_NOT_FOUND);
      const employees = (await m.query(
        `SELECT id FROM employees.employee_records WHERE job_position_id = $1 AND status = 'active' AND deleted_at IS NULL ORDER BY full_name ASC`,
        [jobPositionId],
      )) as { id: string }[];
      let total: BulkAssignmentSummary = { employees: 0, okrsCopied: 0, okrsSkipped: 0, kpisCopied: 0, kpisSkipped: 0 };
      for (const e of employees) {
        total = addSummaries(total, await this.copyForEmployee(m, e.id, jobPositionId, period, actor.id ?? null));
      }
      return { summary: total, position: positions[0] };
    });
    await this.log('assign-bulk', actor, 'job_position', jobPositionId, `${position.code} — ${position.title}`, { period, ...summary });
    return summary;
  }

  /** Baja lógica de un OKR asignado. */
  async removeOkr(id: string, actor: Actor): Promise<void> {
    const hit = firstRow<{ id: string; employee_id: string; period: string }>(
      await this.dataSource.query(
        `UPDATE hr.employee_okrs SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, employee_id, period`,
        [id],
      ),
    );
    if (!hit) throw new NotFoundException(OKR_NOT_FOUND);
    await this.log('remove-okr', actor, 'employee_okr', hit.id, `OKR ${hit.period}`, { employeeId: hit.employee_id, deleted: { from: false, to: true } });
  }

  /** Baja lógica de un KPI asignado. */
  async removeKpi(id: string, actor: Actor): Promise<void> {
    const hit = firstRow<{ id: string; employee_id: string; name: string }>(
      await this.dataSource.query(
        `UPDATE hr.employee_kpis SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, employee_id, name`,
        [id],
      ),
    );
    if (!hit) throw new NotFoundException(KPI_NOT_FOUND);
    await this.log('remove-kpi', actor, 'employee_kpi', hit.id, hit.name, { employeeId: hit.employee_id, deleted: { from: false, to: true } });
  }

  private async log(
    action: string,
    actor: Actor,
    entityType: string,
    entityId: string,
    entityName: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      module: 'desarrollo-organizacional',
      entityType,
      entityId,
      entityName,
      changes,
    });
  }
}
