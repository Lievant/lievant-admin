import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotificationFlowsService } from '../notifications/notification-flows.service';
import { CreateRequisitionDto, MyRequisitionsQueryDto, UpdateRequisitionDto } from './dto/job-requisition.dto';
import {
  DEFAULT_LIMIT,
  NOT_FOUND,
  REQUISITION_FROM,
  REQUISITION_SELECT,
  assertSubmittable,
  buildSubmittedMessage,
  isEditable,
  nextRequisitionCode,
  normalizePosition,
  toDetail,
  toListItem,
  todayMx,
  type RequisitionContent,
  type RequisitionDetail,
  type RequisitionListItem,
  type RequisitionRow,
  type RequisitionType,
} from './job-requisitions.util';
import { RequisitionLeaderService, type Leader } from './requisition-leader.service';

export interface Actor {
  id?: string;
  email?: string;
  name?: string;
}

export interface RequisitionPage {
  data: RequisitionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type Q = { query: DataSource['query'] };

const NOT_EDITABLE = 'La solicitud ya fue enviada y no se puede modificar';

/**
 * Solicitudes de puesto desde el lado del LÍDER. Toda consulta va acotada al
 * empleado de la sesión: una solicitud ajena responde 404 (no 403) para no
 * revelar que existe. El interceptor global no cubre estas rutas (su segmento es
 * `hr`), así que la auditoría es explícita.
 */
@Injectable()
export class JobRequisitionsService {
  private readonly logger = new Logger(JobRequisitionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly leaders: RequisitionLeaderService,
    private readonly audit: AuditService,
    private readonly flows: NotificationFlowsService,
  ) {}

  /** Puestos activos de la Matriz con los datos MÍNIMOS (nunca descripción, OKRs ni KPIs). */
  async positionOptions(userId: string): Promise<{ id: string; code: string; title: string; area: string }[]> {
    await this.leaders.resolve(userId);
    return (await this.dataSource.query(
      `SELECT id, code, title, area FROM hr.job_positions
       WHERE deleted_at IS NULL AND status = 'activo' ORDER BY title ASC`,
    )) as { id: string; code: string; title: string; area: string }[];
  }

  async listMine(userId: string, q: MyRequisitionsQueryDto): Promise<RequisitionPage> {
    const leader = await this.leaders.resolve(userId);
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_LIMIT;
    const params: unknown[] = [leader.employeeId];
    let where = 'r.deleted_at IS NULL AND r.requester_employee_id = $1';
    if (q.status) {
      params.push(q.status);
      where += ` AND r.status = $${params.length}`;
    }
    const rows = (await this.dataSource.query(
      `${REQUISITION_SELECT}, COUNT(*) OVER() AS total_count ${REQUISITION_FROM}
       WHERE ${where} ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as RequisitionRow[];

    let total = rows[0] ? Number(rows[0].total_count) : 0;
    if (!rows[0] && page > 1) {
      const counted = (await this.dataSource.query(`SELECT COUNT(*) AS n FROM hr.job_requisitions r WHERE ${where}`, params)) as { n: string }[];
      total = Number(counted[0]?.n ?? 0);
    }
    return { data: rows.map(toListItem), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getMine(userId: string, id: string): Promise<RequisitionDetail> {
    const leader = await this.leaders.resolve(userId);
    return this.loadDetail(this.dataSource, id, leader.employeeId);
  }

  private async loadDetail(m: Q, id: string, employeeId: string): Promise<RequisitionDetail> {
    const rows = (await m.query(
      `${REQUISITION_SELECT} ${REQUISITION_FROM}
       WHERE r.id = $1 AND r.requester_employee_id = $2 AND r.deleted_at IS NULL`,
      [id, employeeId],
    )) as RequisitionRow[];
    if (!rows[0]) throw new NotFoundException(NOT_FOUND);
    return toDetail(rows[0]);
  }

  /** El puesto elegido debe existir en la Matriz, activo y sin baja. */
  private async assertMatrixPosition(m: Q, jobPositionId: string | null | undefined): Promise<void> {
    if (!jobPositionId) return;
    const rows = (await m.query(
      `SELECT 1 FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL AND status = 'activo'`,
      [jobPositionId],
    )) as unknown[];
    if (!rows[0]) throw new BadRequestException('El puesto elegido no está disponible en la Matriz de Puestos');
  }

  async create(userId: string, dto: CreateRequisitionDto, actor: Actor): Promise<RequisitionDetail> {
    const leader = await this.leaders.resolve(userId);
    const id = await this.dataSource.transaction(async (m) => {
      await this.assertMatrixPosition(m, dto.jobPositionId);
      // Consecutivo bajo candado y sobre TODOS los códigos (incluidos eliminados): nunca se reutilizan.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('hr.job_requisitions.code'))`);
      const codes = (await m.query(`SELECT code FROM hr.job_requisitions`)) as { code: string }[];
      const code = nextRequisitionCode(codes.map((c) => c.code));
      const pos = normalizePosition(dto.jobPositionId ?? null, dto.positionTitle ?? null);
      const rows = (await m.query(
        `INSERT INTO hr.job_requisitions
           (code, requester_employee_id, requester_user_id, type, job_position_id, position_title, area,
            reason, business_justification, required_date, modality, country, basic_profile, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [
          code, leader.employeeId, leader.userId, dto.type, pos.jobPositionId, pos.positionTitle,
          // El área se rellena con la del líder y es editable.
          (dto.area ?? leader.area ?? '').trim(),
          dto.reason ?? null, dto.businessJustification ?? null, dto.requiredDate ?? null,
          dto.modality ?? null, dto.country ?? null, dto.basicProfile ?? null, dto.priority ?? null,
        ],
      )) as { id: string }[];
      return rows[0]!.id;
    });
    const detail = await this.loadDetail(this.dataSource, id, leader.employeeId);
    await this.log('create', actor, detail, { status: { from: null, to: 'borrador' } });
    return detail;
  }

  /** Bloquea y devuelve el borrador del líder; una solicitud ajena o inexistente es 404. */
  private async lockOwn(m: Q, id: string, employeeId: string): Promise<RequisitionRow> {
    const rows = (await m.query(
      `SELECT r.*, to_char(r.required_date, 'YYYY-MM-DD') AS required_date_text
       FROM hr.job_requisitions r
       WHERE r.id = $1 AND r.requester_employee_id = $2 AND r.deleted_at IS NULL FOR UPDATE`,
      [id, employeeId],
    )) as (RequisitionRow & { required_date_text: string | null })[];
    const row = rows[0];
    if (!row) throw new NotFoundException(NOT_FOUND);
    return { ...row, required_date: row.required_date_text };
  }

  async update(userId: string, id: string, dto: UpdateRequisitionDto, actor: Actor): Promise<RequisitionDetail> {
    const leader = await this.leaders.resolve(userId);
    const changed = await this.dataSource.transaction(async (m) => {
      const cur = await this.lockOwn(m, id, leader.employeeId);
      if (!isEditable(cur.status)) throw new ConflictException(NOT_EDITABLE);
      await this.assertMatrixPosition(m, dto.jobPositionId);

      const pos = normalizePosition(
        dto.jobPositionId !== undefined ? dto.jobPositionId : cur.job_position_id,
        dto.positionTitle !== undefined ? dto.positionTitle : cur.position_title,
      );
      const next = {
        type: dto.type ?? cur.type,
        area: dto.area !== undefined ? (dto.area ?? '').trim() : cur.area,
        reason: dto.reason !== undefined ? dto.reason : cur.reason,
        justification: dto.businessJustification !== undefined ? dto.businessJustification : cur.business_justification,
        requiredDate: dto.requiredDate !== undefined ? dto.requiredDate : cur.required_date,
        modality: dto.modality !== undefined ? dto.modality : cur.modality,
        country: dto.country !== undefined ? dto.country : cur.country,
        profile: dto.basicProfile !== undefined ? dto.basicProfile : cur.basic_profile,
        priority: dto.priority !== undefined ? dto.priority : cur.priority,
      };
      await m.query(
        `UPDATE hr.job_requisitions SET type=$2, job_position_id=$3, position_title=$4, area=$5, reason=$6,
           business_justification=$7, required_date=$8, modality=$9, country=$10, basic_profile=$11,
           priority=$12, updated_at=NOW()
         WHERE id=$1`,
        [id, next.type, pos.jobPositionId, pos.positionTitle, next.area, next.reason, next.justification,
         next.requiredDate, next.modality, next.country, next.profile, next.priority],
      );
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      if (cur.type !== next.type) diff.type = { from: cur.type, to: next.type };
      if (cur.area !== next.area) diff.area = { from: cur.area, to: next.area };
      if (cur.priority !== next.priority) diff.priority = { from: cur.priority, to: next.priority };
      if (cur.job_position_id !== pos.jobPositionId) diff.jobPositionId = { from: cur.job_position_id, to: pos.jobPositionId };
      return diff;
    });
    const detail = await this.loadDetail(this.dataSource, id, leader.employeeId);
    await this.log('update', actor, detail, changed);
    return detail;
  }

  /** Enviar a RRHH: valida todo, pasa a `enviada` (solo lectura desde aquí) y avisa a quienes pueden aprobar. */
  async submit(userId: string, id: string, actor: Actor): Promise<RequisitionDetail> {
    const leader = await this.leaders.resolve(userId);
    await this.dataSource.transaction(async (m) => {
      const cur = await this.lockOwn(m, id, leader.employeeId);
      if (!isEditable(cur.status)) throw new ConflictException(NOT_EDITABLE);
      const content: RequisitionContent = {
        type: cur.type,
        jobPositionId: cur.job_position_id,
        positionTitle: cur.position_title,
        area: cur.area,
        reason: cur.reason,
        businessJustification: cur.business_justification,
        requiredDate: cur.required_date,
        modality: cur.modality,
        country: cur.country,
        basicProfile: cur.basic_profile,
        priority: cur.priority,
      };
      assertSubmittable(content, todayMx());
      // El puesto de la Matriz pudo desactivarse después de elegirlo en el borrador.
      await this.assertMatrixPosition(m, cur.job_position_id);
      await m.query(
        `UPDATE hr.job_requisitions SET status = 'enviada', submitted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id],
      );
    });
    const detail = await this.loadDetail(this.dataSource, id, leader.employeeId);
    await this.log('submit', actor, detail, { status: { from: 'borrador', to: 'enviada' } });

    // Un fallo al notificar NUNCA revierte el envío (ya está confirmado): se registra y se sigue.
    try {
      await this.flows.notify('rrhh', 'solicitud_puesto_enviada', {
        requesterId: leader.userId,
        requesterEmployeeId: leader.employeeId,
        actorId: leader.userId,
        entityId: detail.id,
        entityType: 'job_requisition',
        senderName: leader.fullName,
        title: `Nueva solicitud de puesto ${detail.code}`,
        message: buildSubmittedMessage({
          code: detail.code,
          requesterName: leader.fullName,
          type: detail.type as RequisitionType,
          positionLabel: detail.positionLabel ?? 'Puesto sin nombre',
          priority: detail.priority,
          inMatrix: detail.jobPositionId !== null,
        }),
        actionUrl: '/rrhh/solicitudes-puesto',
      });
    } catch (err) {
      this.logger.error(`No se pudo notificar el envío de ${detail.code}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return detail;
  }

  /** Baja lógica, solo en borrador. */
  async remove(userId: string, id: string, actor: Actor): Promise<void> {
    const leader = await this.leaders.resolve(userId);
    const removed = await this.dataSource.transaction(async (m) => {
      const cur = await this.lockOwn(m, id, leader.employeeId);
      if (!isEditable(cur.status)) throw new ConflictException('Solo se pueden eliminar solicitudes en borrador');
      await m.query(`UPDATE hr.job_requisitions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
      return cur;
    });
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'delete',
      module: 'solicitudes-puesto',
      entityType: 'job_requisition',
      entityId: removed.id,
      entityName: removed.code,
      changes: { deleted: { from: false, to: true } },
    });
  }

  private async log(
    action: 'create' | 'update' | 'submit',
    actor: Actor,
    d: RequisitionDetail,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      module: 'solicitudes-puesto',
      entityType: 'job_requisition',
      entityId: d.id,
      entityName: d.code,
      changes,
    });
  }
}

export type { Leader };
