import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateActivityDto, UpdateActivityDto } from './dto/job-position.dto';
import type { Actor } from './job-positions.service';
import { ACTIVITY_NOT_FOUND, POSITION_NOT_FOUND, toActivityView, type ActivityRow, type ActivityView } from './job-positions.util';

const COLS = 'id, job_position_id, group_order, group_title, sort_order, description, frequency, note';

function firstRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result)) return undefined;
  const head = result[0];
  return (Array.isArray(head) ? head[0] : head) as T | undefined;
}

/** Actividades (responsabilidades) de un puesto, agrupadas por grupo. Toda escritura deja auditoría explícita. */
@Injectable()
export class JobPositionActivitiesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  private async position(positionId: string): Promise<{ id: string; code: string; title: string }> {
    const rows = (await this.dataSource.query(
      `SELECT id, code, title FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL`,
      [positionId],
    )) as { id: string; code: string; title: string }[];
    if (!rows[0]) throw new NotFoundException(POSITION_NOT_FOUND);
    return rows[0];
  }

  private async log(action: 'create' | 'update' | 'delete', actor: Actor, id: string, name: string, changes: Record<string, unknown>): Promise<void> {
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      module: 'matriz-puestos',
      entityType: 'job_position_activity',
      entityId: id,
      entityName: name,
      changes,
    });
  }

  async list(positionId: string): Promise<ActivityView[]> {
    await this.position(positionId);
    const rows = (await this.dataSource.query(
      `SELECT ${COLS} FROM hr.job_position_activities WHERE job_position_id = $1 AND deleted_at IS NULL
       ORDER BY group_order ASC, sort_order ASC, created_at ASC`,
      [positionId],
    )) as ActivityRow[];
    return rows.map(toActivityView);
  }

  async create(positionId: string, dto: CreateActivityDto, actor: Actor): Promise<ActivityView> {
    const position = await this.position(positionId);
    const row = firstRow<ActivityRow>(
      await this.dataSource.query(
        `INSERT INTO hr.job_position_activities (job_position_id, group_order, group_title, sort_order, description, frequency, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLS}`,
        [positionId, dto.groupOrder, dto.groupTitle.trim(), dto.sortOrder ?? 0, dto.description.trim(), dto.frequency ?? null, dto.note ?? null],
      ),
    );
    await this.log('create', actor, row!.id, `${position.code} · ${row!.group_title}`, { description: { from: null, to: 'nueva' } });
    return toActivityView(row!);
  }

  async update(activityId: string, dto: UpdateActivityDto, actor: Actor): Promise<ActivityView> {
    const cur = ((await this.dataSource.query(
      `SELECT ${COLS} FROM hr.job_position_activities WHERE id = $1 AND deleted_at IS NULL`,
      [activityId],
    )) as ActivityRow[])[0];
    if (!cur) throw new NotFoundException(ACTIVITY_NOT_FOUND);
    const next = {
      groupOrder: dto.groupOrder ?? cur.group_order,
      groupTitle: dto.groupTitle?.trim() ?? cur.group_title,
      sortOrder: dto.sortOrder ?? cur.sort_order,
      description: dto.description?.trim() ?? cur.description,
      frequency: dto.frequency !== undefined ? dto.frequency : cur.frequency,
      note: dto.note !== undefined ? dto.note : cur.note,
    };
    const after = firstRow<ActivityRow>(
      await this.dataSource.query(
        `UPDATE hr.job_position_activities SET group_order=$2, group_title=$3, sort_order=$4, description=$5,
           frequency=$6, note=$7, updated_at=NOW()
         WHERE id=$1 AND deleted_at IS NULL RETURNING ${COLS}`,
        [activityId, next.groupOrder, next.groupTitle, next.sortOrder, next.description, next.frequency, next.note],
      ),
    );
    if (!after) throw new NotFoundException(ACTIVITY_NOT_FOUND);
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    if (cur.group_order !== after.group_order) diff.groupOrder = { from: cur.group_order, to: after.group_order };
    if (cur.group_title !== after.group_title) diff.groupTitle = { from: cur.group_title, to: after.group_title };
    if (cur.frequency !== after.frequency) diff.frequency = { from: cur.frequency, to: after.frequency };
    if (cur.description !== after.description) diff.description = { from: 'modificada', to: 'modificada' };
    if (cur.note !== after.note) diff.note = { from: 'modificada', to: 'modificada' };
    await this.log('update', actor, activityId, after.group_title, diff);
    return toActivityView(after);
  }

  async remove(activityId: string, actor: Actor): Promise<void> {
    const hit = firstRow<{ id: string; group_title: string }>(
      await this.dataSource.query(
        `UPDATE hr.job_position_activities SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, group_title`,
        [activityId],
      ),
    );
    if (!hit) throw new NotFoundException(ACTIVITY_NOT_FOUND);
    await this.log('delete', actor, hit.id, hit.group_title, { deleted: { from: false, to: true } });
  }
}
