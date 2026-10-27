import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { User } from '../auth/entities/user.entity';
import { EmployeeDevelopmentService } from '../employee-development/employee-development.service';
import { currentPeriodMx } from '../employee-development/employee-development.util';
import { RequisitionLeaderService, type Leader } from '../job-requisitions/requisition-leader.service';
import { SaveEvaluationDto } from './dto/okr-evaluations.dto';
import {
  NOT_FOUND,
  OKR_NOT_FOUND,
  assertEvaluablePeriod,
  assertValidPeriod,
  evaluablePeriods,
  isEvaluablePeriod,
  mergeEvaluation,
  type EvaluationStatus,
} from './okr-evaluations.util';

export interface Actor {
  id?: string;
  email?: string;
  name?: string;
}

type AuthUser = Pick<User, 'id' | 'roles' | 'userPermissions'>;

export interface TeamMemberView {
  employeeId: string;
  fullName: string;
  position: string | null;
  assigned: number;
  evaluated: number;
}

export interface TeamOkrView {
  employeeOkrId: string;
  objective: string;
  keyResult: string;
  weight: number | null;
  score: number | null;
  comments: string | null;
  status: EvaluationStatus;
  evaluatedAt: string | null;
}

/**
 * Evaluación de OKRs desde el lado del LÍDER (RRHH 2.0 · M7). Solo el líder
 * DIRECTO del colaborador califica (la regla reutiliza `resolveAccess` del M5:
 * `isDirectLeader`, no transitivo). RRHH con permiso ve, pero nunca califica.
 * Todo lo ajeno responde 404. El interceptor global no cubre estas rutas
 * (segmento `hr`), así que la auditoría es explícita.
 */
@Injectable()
export class OkrEvaluationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly leaders: RequisitionLeaderService,
    private readonly development: EmployeeDevelopmentService,
  ) {}

  async periods(userId: string, now: Date = new Date()): Promise<{ periods: string[]; current: string }> {
    await this.leaders.resolve(userId);
    return { periods: evaluablePeriods(now), current: currentPeriodMx(now) };
  }

  /** Colaboradores directos y activos del líder con su avance (evaluados / asignados) en el periodo. */
  async myTeam(userId: string, period?: string): Promise<{ period: string; editable: boolean; team: TeamMemberView[] }> {
    const leader = await this.leaders.resolve(userId);
    const chosen = period ?? currentPeriodMx();
    assertValidPeriod(chosen);
    const rows = (await this.dataSource.query(
      `SELECT e.id, e.full_name, e.position,
              COUNT(o.id) AS assigned,
              COUNT(ev.id) FILTER (WHERE ev.score IS NOT NULL) AS evaluated
       FROM employees.employee_records e
       LEFT JOIN hr.employee_okrs o ON o.employee_id = e.id AND o.period = $2 AND o.deleted_at IS NULL AND o.is_active = true
       LEFT JOIN hr.okr_evaluations ev ON ev.employee_okr_id = o.id AND ev.deleted_at IS NULL
       WHERE e.direct_report_to_id = $1 AND e.id <> $1 AND e.status = 'active' AND e.deleted_at IS NULL
       GROUP BY e.id ORDER BY e.full_name ASC`,
      [leader.employeeId, chosen],
    )) as { id: string; full_name: string; position: string | null; assigned: string; evaluated: string }[];
    return {
      period: chosen,
      editable: isEvaluablePeriod(chosen),
      team: rows.map((r) => ({ employeeId: r.id, fullName: r.full_name, position: r.position, assigned: Number(r.assigned), evaluated: Number(r.evaluated) })),
    };
  }

  /** Verifica que el empleado sea subordinado DIRECTO y activo del líder; si no, 404 (no se revela que existe). */
  private async assertDirectReport(user: AuthUser, leader: Leader, employeeId: string): Promise<{ id: string; full_name: string; position: string | null }> {
    const facts = await this.development.resolveAccess(user, employeeId);
    const rows = (await this.dataSource.query(
      `SELECT id, full_name, position FROM employees.employee_records
       WHERE id = $1 AND direct_report_to_id = $2 AND status = 'active' AND deleted_at IS NULL`,
      [employeeId, leader.employeeId],
    )) as { id: string; full_name: string; position: string | null }[];
    if (!facts.isDirectLeader || !rows[0]) throw new NotFoundException(NOT_FOUND);
    return rows[0];
  }

  async memberOkrs(user: AuthUser, employeeId: string, period?: string) {
    const leader = await this.leaders.resolve(user.id);
    const emp = await this.assertDirectReport(user, leader, employeeId);
    const chosen = period ?? currentPeriodMx();
    assertValidPeriod(chosen);
    const rows = (await this.dataSource.query(
      `SELECT o.id, o.objective, o.key_result, o.weight, ev.score, ev.comments, ev.status, ev.evaluated_at
       FROM hr.employee_okrs o
       LEFT JOIN hr.okr_evaluations ev ON ev.employee_okr_id = o.id AND ev.deleted_at IS NULL
       WHERE o.employee_id = $1 AND o.period = $2 AND o.deleted_at IS NULL AND o.is_active = true
       ORDER BY o.sort_order ASC, o.created_at ASC`,
      [employeeId, chosen],
    )) as { id: string; objective: string; key_result: string; weight: string | null; score: string | null; comments: string | null; status: EvaluationStatus | null; evaluated_at: Date | null }[];
    const okrs: TeamOkrView[] = rows.map((r) => ({
      employeeOkrId: r.id,
      objective: r.objective,
      keyResult: r.key_result,
      weight: r.weight === null ? null : Number(r.weight),
      score: r.score === null ? null : Number(r.score),
      comments: r.comments,
      status: r.status ?? 'pendiente',
      evaluatedAt: r.evaluated_at ? new Date(r.evaluated_at).toISOString() : null,
    }));
    return {
      employee: { id: emp.id, fullName: emp.full_name, position: emp.position },
      period: chosen,
      editable: isEvaluablePeriod(chosen),
      assigned: okrs.length,
      evaluated: okrs.filter((o) => o.score !== null).length,
      okrs,
    };
  }

  /**
   * Crea o actualiza (upsert por OKR asignado) la evaluación. El primer guardado
   * toma los snapshots de objetivo, resultado clave y peso; cada cambio actualiza
   * al evaluador y deja auditoría con el valor anterior y el nuevo de la calificación.
   */
  async save(user: AuthUser, employeeId: string, employeeOkrId: string, dto: SaveEvaluationDto, actor: Actor): Promise<TeamOkrView> {
    const leader = await this.leaders.resolve(user.id);
    const emp = await this.assertDirectReport(user, leader, employeeId);

    const result = await this.dataSource.transaction(async (m) => {
      const okrs = (await m.query(
        `SELECT id, period, objective, key_result, weight FROM hr.employee_okrs
         WHERE id = $1 AND employee_id = $2 AND deleted_at IS NULL AND is_active = true FOR UPDATE`,
        [employeeOkrId, employeeId],
      )) as { id: string; period: string; objective: string; key_result: string; weight: string | null }[];
      const okr = okrs[0];
      if (!okr) throw new NotFoundException(OKR_NOT_FOUND);
      assertEvaluablePeriod(okr.period);

      const cur = ((await m.query(
        `SELECT score, comments FROM hr.okr_evaluations WHERE employee_okr_id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [employeeOkrId],
      )) as { score: string | null; comments: string | null }[])[0];
      const before = cur ? { score: cur.score === null ? null : Number(cur.score), comments: cur.comments } : null;
      const next = mergeEvaluation(before, { score: dto.score, comments: dto.comments });

      const saved = (await m.query(
        `INSERT INTO hr.okr_evaluations
           (employee_okr_id, employee_id, evaluator_employee_id, evaluator_user_id, period, objective, key_result, weight,
            score, comments, status, evaluated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $9::numeric IS NULL THEN NULL ELSE NOW() END)
         ON CONFLICT (employee_okr_id) WHERE deleted_at IS NULL DO UPDATE SET
           evaluator_employee_id = EXCLUDED.evaluator_employee_id, evaluator_user_id = EXCLUDED.evaluator_user_id,
           score = EXCLUDED.score, comments = EXCLUDED.comments, status = EXCLUDED.status,
           evaluated_at = CASE WHEN EXCLUDED.score IS NULL THEN NULL ELSE NOW() END, updated_at = NOW()
         RETURNING score, comments, status, evaluated_at`,
        [employeeOkrId, employeeId, leader.employeeId, leader.userId, okr.period, okr.objective, okr.key_result, okr.weight, next.score, next.comments, next.status],
      )) as { score: string | null; comments: string | null; status: EvaluationStatus; evaluated_at: Date | null }[];
      return { okr, before, saved: saved[0] as (typeof saved)[number], next };
    });

    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'evaluate',
      module: 'okrs',
      entityType: 'okr_evaluation',
      entityId: employeeOkrId,
      entityName: `${emp.full_name} · ${result.okr.period}`,
      // El texto de los comentarios no se guarda en la bitácora: solo si cambió.
      changes: {
        employeeId,
        period: result.okr.period,
        score: { from: result.before?.score ?? null, to: result.next.score },
        commentsChanged: (result.before?.comments ?? null) !== result.next.comments,
      },
    });

    return {
      employeeOkrId,
      objective: result.okr.objective,
      keyResult: result.okr.key_result,
      weight: result.okr.weight === null ? null : Number(result.okr.weight),
      score: result.saved.score === null ? null : Number(result.saved.score),
      comments: result.saved.comments,
      status: result.saved.status,
      evaluatedAt: result.saved.evaluated_at ? new Date(result.saved.evaluated_at).toISOString() : null,
    };
  }
}
