import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotificationFlowsService } from '../notifications/notification-flows.service';
import { ReviewQueryDto } from './dto/job-requisition.dto';
import {
  DEFAULT_LIMIT,
  NOT_FOUND,
  REQUISITION_FROM,
  REQUISITION_SELECT,
  SUMMARY_SQL,
  buildResolvedMessage,
  buildReviewWhere,
  canTransition,
  normalizeReviewComments,
  toDetail,
  toListItem,
  type RequisitionDetail,
  type RequisitionRow,
  type RequisitionStatus,
} from './job-requisitions.util';
import type { Actor, RequisitionPage } from './job-requisitions.service';

export interface RequisitionSummary {
  pending: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

/**
 * Lado de RRHH: ve solo `enviada`, `aprobada` y `rechazada` (nunca borradores) y
 * resuelve con el permiso `approve`. Nadie resuelve su propia solicitud.
 */
@Injectable()
export class JobRequisitionsReviewService {
  private readonly logger = new Logger(JobRequisitionsReviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly flows: NotificationFlowsService,
  ) {}

  async getOptions(): Promise<{ areas: string[] }> {
    const rows = (await this.dataSource.query(
      `SELECT DISTINCT area AS v FROM hr.job_requisitions
       WHERE deleted_at IS NULL AND status <> 'borrador' AND area <> '' ORDER BY area ASC`,
    )) as { v: string }[];
    return { areas: rows.map((r) => r.v) };
  }

  async getSummary(): Promise<RequisitionSummary> {
    const rows = (await this.dataSource.query(SUMMARY_SQL)) as {
      pending: string;
      approved_this_month: string;
      rejected_this_month: string;
    }[];
    const r = rows[0];
    return {
      pending: Number(r?.pending ?? 0),
      approvedThisMonth: Number(r?.approved_this_month ?? 0),
      rejectedThisMonth: Number(r?.rejected_this_month ?? 0),
    };
  }

  async list(q: ReviewQueryDto): Promise<RequisitionPage> {
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_LIMIT;
    const { where, params } = buildReviewWhere({ status: q.status, area: q.area, from: q.from, to: q.to, search: q.search });
    const rows = (await this.dataSource.query(
      `${REQUISITION_SELECT}, COUNT(*) OVER() AS total_count ${REQUISITION_FROM}
       WHERE ${where} ORDER BY r.submitted_at DESC, r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as RequisitionRow[];

    let total = rows[0] ? Number(rows[0].total_count) : 0;
    if (!rows[0] && page > 1) {
      const counted = (await this.dataSource.query(
        `SELECT COUNT(*) AS n ${REQUISITION_FROM} WHERE ${where}`,
        params,
      )) as { n: string }[];
      total = Number(counted[0]?.n ?? 0);
    }
    return { data: rows.map(toListItem), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getDetail(id: string): Promise<RequisitionDetail> {
    const rows = (await this.dataSource.query(
      `${REQUISITION_SELECT} ${REQUISITION_FROM}
       WHERE r.id = $1 AND r.deleted_at IS NULL AND r.status <> 'borrador'`,
      [id],
    )) as RequisitionRow[];
    if (!rows[0]) throw new NotFoundException(NOT_FOUND);
    return toDetail(rows[0]);
  }

  approve(id: string, comments: string | null | undefined, actor: Actor): Promise<RequisitionDetail> {
    return this.resolve(id, 'aprobada', comments, actor);
  }

  reject(id: string, comments: string | null | undefined, actor: Actor): Promise<RequisitionDetail> {
    return this.resolve(id, 'rechazada', comments, actor);
  }

  private async resolve(
    id: string,
    decision: 'aprobada' | 'rechazada',
    rawComments: string | null | undefined,
    actor: Actor,
  ): Promise<RequisitionDetail> {
    const comments = normalizeReviewComments(decision, rawComments);

    const before = await this.dataSource.transaction(async (m) => {
      const rows = (await m.query(
        `SELECT id, code, status, requester_user_id FROM hr.job_requisitions
         WHERE id = $1 AND deleted_at IS NULL AND status <> 'borrador' FOR UPDATE`,
        [id],
      )) as { id: string; code: string; status: RequisitionStatus; requester_user_id: string }[];
      const cur = rows[0];
      if (!cur) throw new NotFoundException(NOT_FOUND);
      if (cur.requester_user_id === actor.id) {
        throw new ForbiddenException('No puedes resolver tu propia solicitud');
      }
      if (!canTransition(cur.status, decision)) {
        throw new ConflictException('Solo se pueden resolver solicitudes en estado Enviada');
      }
      await m.query(
        `UPDATE hr.job_requisitions SET status = $2, reviewed_by = $3, reviewed_at = NOW(),
           review_comments = $4, updated_at = NOW() WHERE id = $1`,
        [id, decision, actor.id ?? null, comments],
      );
      return cur;
    });

    const detail = await this.getDetail(id);
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: decision === 'aprobada' ? 'approve' : 'reject',
      module: 'solicitudes-puesto',
      entityType: 'job_requisition',
      entityId: detail.id,
      entityName: detail.code,
      changes: { status: { from: before.status, to: decision } },
    });

    // Aviso al solicitante; un fallo aquí no revierte la resolución (ya confirmada).
    try {
      await this.flows.notify('rrhh', 'solicitud_puesto_resuelta', {
        requesterId: before.requester_user_id,
        actorId: actor.id ?? null,
        entityId: detail.id,
        entityType: 'job_requisition',
        ...(actor.name ? { senderName: actor.name } : {}),
        title: `Solicitud ${detail.code} ${decision === 'aprobada' ? 'aprobada' : 'rechazada'}`,
        message: buildResolvedMessage(detail.code, decision, comments),
        actionUrl: '/herramientas/solicitud-puesto',
        notificationType: decision === 'rechazada' ? 'atencion' : 'informativa',
      });
    } catch (err) {
      this.logger.error(`No se pudo notificar la resolución de ${detail.code}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return detail;
  }
}
