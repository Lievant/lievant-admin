import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreatePositionDto, PositionQueryDto, UpdatePositionDto } from './dto/job-position.dto';
import {
  DEFAULT_LIMIT,
  POSITION_NOT_FOUND,
  VALIDATION_STATUSES,
  applyDescriptionChange,
  applyValidationChange,
  assertCanApprove,
  buildPositionWhere,
  nextPositionCode,
  normalizeDescription,
  resolveStatus,
  statusAfterApproval,
  toDetail,
  toActivityView,
  toKpiView,
  toListItem,
  toOkrView,
  type ActivityRow,
  type KpiRow,
  type OkrRow,
  type PositionDetail,
  type PositionListItem,
  type PositionRow,
  type PositionStatus,
  type ValidationStatus,
} from './job-positions.util';

export interface Actor {
  id?: string;
  email?: string;
  name?: string;
}

export interface PositionPage {
  data: PositionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DETAIL_SQL = `
  SELECT p.*, u.name AS approver_name, v.name AS validator_name
  FROM hr.job_positions p
  LEFT JOIN auth.users u ON u.id = p.description_approved_by
  LEFT JOIN auth.users v ON v.id = p.validated_by
  WHERE p.id = $1 AND p.deleted_at IS NULL`;

type Q = { query: DataSource['query'] };

/** Campos de texto/número simples del puesto: clave del DTO → columna. */
const SIMPLE_FIELDS = {
  division: 'division',
  meotHierarchy: 'meot_hierarchy',
  reportsTo: 'reports_to_text',
  supervises: 'supervises_text',
  plazas: 'plazas',
  roleSummary: 'role_summary',
  positionObjective: 'position_objective',
  validationPoints: 'validation_points',
  headComments: 'head_comments',
} as const;
type SimpleKey = keyof typeof SIMPLE_FIELDS;
/** Los textos largos no se guardan en la bitácora: solo que cambiaron. */
const LONG_TEXT: ReadonlySet<SimpleKey> = new Set(['roleSummary', 'positionObjective', 'validationPoints', 'headComments']);

/** El UPDATE ... RETURNING de TypeORM llega como [filas, afectadas]; esto lee la primera fila en ambos casos. */
function firstRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result)) return undefined;
  const head = result[0];
  return (Array.isArray(head) ? head[0] : head) as T | undefined;
}

/**
 * Puestos de la Matriz de Puestos. SQL directo sobre el DataSource; las
 * operaciones que escriben van en transacción. El interceptor global no cubre
 * estas rutas (su segmento es `hr`), así que la auditoría es explícita.
 */
@Injectable()
export class JobPositionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async getOptions(): Promise<{
    areas: string[];
    businessUnits: string[];
    divisions: string[];
    levels: string[];
    validationStatuses: readonly ValidationStatus[];
  }> {
    const distinct = async (col: 'area' | 'business_unit' | 'level' | 'division'): Promise<string[]> => {
      const rows = (await this.dataSource.query(
        `SELECT DISTINCT ${col} AS v FROM hr.job_positions
         WHERE deleted_at IS NULL AND ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col} ASC`,
      )) as { v: string }[];
      return rows.map((r) => r.v);
    };
    const [areas, businessUnits, divisions, levels] = await Promise.all([
      distinct('area'),
      distinct('business_unit'),
      distinct('division'),
      distinct('level'),
    ]);
    return { areas, businessUnits, divisions, levels, validationStatuses: VALIDATION_STATUSES };
  }

  async list(q: PositionQueryDto): Promise<PositionPage> {
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_LIMIT;
    const { where, params } = buildPositionWhere({
      area: q.area,
      businessUnit: q.businessUnit,
      division: q.division,
      level: q.level,
      status: q.status,
      validationStatus: q.validationStatus,
      search: q.search,
    });
    // Total en la misma consulta; el orden numérico del código evita que JP-1000 quede antes que JP-200.
    const rows = (await this.dataSource.query(
      `SELECT p.*, COUNT(*) OVER() AS total_count FROM hr.job_positions p
       WHERE ${where}
       ORDER BY length(p.code) ASC, p.code ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as PositionRow[];

    let total = rows[0] ? Number(rows[0].total_count) : 0;
    if (!rows[0] && page > 1) {
      const counted = (await this.dataSource.query(
        `SELECT COUNT(*) AS n FROM hr.job_positions p WHERE ${where}`,
        params,
      )) as { n: string }[];
      total = Number(counted[0]?.n ?? 0);
    }
    return { data: rows.map(toListItem), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Puesto con sus OKRs y KPIs vivos; el nombre de quien aprobó sale del mismo JOIN (sin N+1). */
  async getDetail(id: string, m: Q = this.dataSource): Promise<PositionDetail> {
    const rows = (await m.query(DETAIL_SQL, [id])) as PositionRow[];
    const row = rows[0];
    if (!row) throw new NotFoundException(POSITION_NOT_FOUND);
    const [okrs, kpis, activities] = await Promise.all([
      m.query(
        `SELECT id, job_position_id, period, objective_code, kr_code, objective, key_result, weight, sort_order, is_active
         FROM hr.job_position_okrs WHERE job_position_id = $1 AND deleted_at IS NULL
         ORDER BY period DESC NULLS FIRST, sort_order ASC, created_at ASC`,
        [id],
      ) as Promise<OkrRow[]>,
      m.query(
        `SELECT id, job_position_id, name, description, target_value, measurement_frequency, is_active
         FROM hr.job_position_kpis WHERE job_position_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [id],
      ) as Promise<KpiRow[]>,
      m.query(
        `SELECT id, job_position_id, group_order, group_title, sort_order, description, frequency, note
         FROM hr.job_position_activities WHERE job_position_id = $1 AND deleted_at IS NULL
         ORDER BY group_order ASC, sort_order ASC, created_at ASC`,
        [id],
      ) as Promise<ActivityRow[]>,
    ]);
    return toDetail(row, okrs.map(toOkrView), kpis.map(toKpiView), activities.map(toActivityView));
  }

  async create(dto: CreatePositionDto, actor: Actor): Promise<PositionDetail> {
    const id = await this.dataSource.transaction(async (m) => {
      // El consecutivo se calcula bajo un candado para que dos altas simultáneas no choquen;
      // lee también los códigos de puestos eliminados, así que nunca se reutilizan.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('hr.job_positions.code'))`);
      const codes = (await m.query(`SELECT code FROM hr.job_positions`)) as { code: string }[];
      const code = nextPositionCode(codes.map((c) => c.code));

      const description = normalizeDescription(dto.description);
      const status = resolveStatus((dto.status as PositionStatus | undefined) ?? 'activo', { description, approved: false });
      const rows = (await m.query(
        `INSERT INTO hr.job_positions (code, title, area, business_unit, level, description, status, created_by,
           division, meot_hierarchy, reports_to_text, supervises_text, plazas, role_summary, position_objective, validation_points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          code, dto.title.trim(), dto.area.trim(), dto.businessUnit ?? null, dto.level ?? null, description, status, actor.id ?? null,
          dto.division ?? null, dto.meotHierarchy ?? null, dto.reportsTo ?? null, dto.supervises ?? null, dto.plazas ?? null,
          dto.roleSummary ?? null, dto.positionObjective ?? null, dto.validationPoints ?? null,
        ],
      )) as { id: string }[];
      return rows[0]!.id;
    });
    const detail = await this.getDetail(id);
    await this.log('create', actor, detail, { code: { from: null, to: detail.code }, status: { from: null, to: detail.status } });
    return detail;
  }

  async update(id: string, dto: UpdatePositionDto, actor: Actor): Promise<PositionDetail> {
    const changes = await this.dataSource.transaction(async (m) => {
      const rows = (await m.query(
        `SELECT * FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      )) as PositionRow[];
      const cur = rows[0];
      if (!cur) throw new NotFoundException(POSITION_NOT_FOUND);

      const desc = applyDescriptionChange(
        {
          description: cur.description,
          approved: cur.description_approved,
          approvedBy: cur.description_approved_by,
          approvedAt: cur.description_approved_at,
        },
        dto.description,
      );
      const requested = ((dto.status as PositionStatus | undefined) ?? cur.status) as PositionStatus;
      const status = resolveStatus(requested, desc);

      const next = {
        title: dto.title?.trim() ?? cur.title,
        area: dto.area?.trim() ?? cur.area,
        business_unit: dto.businessUnit !== undefined ? dto.businessUnit : cur.business_unit,
        level: dto.level !== undefined ? dto.level : cur.level,
      };
      const simple = {} as Record<SimpleKey, unknown>;
      for (const key of Object.keys(SIMPLE_FIELDS) as SimpleKey[]) {
        const incoming = dto[key];
        simple[key] = incoming !== undefined ? incoming : (cur as unknown as Record<string, unknown>)[SIMPLE_FIELDS[key]];
      }
      const validation = applyValidationChange(
        { status: cur.validation_status, by: cur.validated_by, at: cur.validated_at },
        dto.validationStatus,
        actor.id ?? null,
        new Date(),
      );
      await m.query(
        `UPDATE hr.job_positions SET title=$2, area=$3, business_unit=$4, level=$5, description=$6,
           description_approved=$7, description_approved_by=$8, description_approved_at=$9,
           status=$10, division=$11, meot_hierarchy=$12, reports_to_text=$13, supervises_text=$14, plazas=$15,
           role_summary=$16, position_objective=$17, validation_points=$18, head_comments=$19,
           validation_status=$20, validated_by=$21, validated_at=$22, updated_at=NOW()
         WHERE id=$1`,
        [
          id, next.title, next.area, next.business_unit, next.level, desc.description, desc.approved, desc.approvedBy, desc.approvedAt, status,
          simple.division, simple.meotHierarchy, simple.reportsTo, simple.supervises, simple.plazas,
          simple.roleSummary, simple.positionObjective, simple.validationPoints, simple.headComments,
          validation.status, validation.by, validation.at,
        ],
      );

      const diff: Record<string, { from: unknown; to: unknown }> = {};
      if (cur.title !== next.title) diff.title = { from: cur.title, to: next.title };
      if (cur.area !== next.area) diff.area = { from: cur.area, to: next.area };
      if (cur.business_unit !== next.business_unit) diff.businessUnit = { from: cur.business_unit, to: next.business_unit };
      if (cur.level !== next.level) diff.level = { from: cur.level, to: next.level };
      if (cur.status !== status) diff.status = { from: cur.status, to: status };
      for (const key of Object.keys(SIMPLE_FIELDS) as SimpleKey[]) {
        const before = (cur as unknown as Record<string, unknown>)[SIMPLE_FIELDS[key]] ?? null;
        const after = simple[key] ?? null;
        if (before !== after) diff[key] = LONG_TEXT.has(key) ? { from: 'modificado', to: 'modificado' } : { from: before, to: after };
      }
      if (cur.validation_status !== validation.status) diff.validationStatus = { from: cur.validation_status, to: validation.status };
      // El texto de la descripción no se guarda en la bitácora: solo que cambió y si se invalidó la aprobación.
      if (cur.description !== desc.description) diff.description = { from: 'modificada', to: 'modificada' };
      if (cur.description_approved && !desc.approved) diff.descriptionApproved = { from: true, to: false };
      return diff;
    });
    const detail = await this.getDetail(id);
    await this.log('update', actor, detail, changes);
    return detail;
  }

  /** Aprobar la descripción (permiso `approve`): quién y cuándo salen de la sesión. */
  async approveDescription(id: string, actor: Actor): Promise<PositionDetail> {
    await this.dataSource.transaction(async (m) => {
      const rows = (await m.query(
        `SELECT * FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      )) as PositionRow[];
      const cur = rows[0];
      if (!cur) throw new NotFoundException(POSITION_NOT_FOUND);
      assertCanApprove({ description: cur.description, approved: cur.description_approved });
      await m.query(
        `UPDATE hr.job_positions SET description_approved = true, description_approved_by = $2,
           description_approved_at = NOW(), status = $3, updated_at = NOW() WHERE id = $1`,
        [id, actor.id ?? null, statusAfterApproval(cur.status)],
      );
    });
    const detail = await this.getDetail(id);
    await this.log('approve', actor, detail, { descriptionApproved: { from: false, to: true }, status: { from: null, to: detail.status } });
    return detail;
  }

  /** Baja lógica del puesto y, en la misma transacción, de sus OKRs, KPIs y actividades. */
  async remove(id: string, actor: Actor): Promise<void> {
    const removed = await this.dataSource.transaction(async (m) => {
      const hit = firstRow<{ id: string; code: string; title: string }>(
        await m.query(
          `UPDATE hr.job_positions SET deleted_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL RETURNING id, code, title`,
          [id],
        ),
      );
      if (!hit) throw new NotFoundException(POSITION_NOT_FOUND);
      await m.query(
        `UPDATE hr.job_position_okrs SET deleted_at = NOW(), updated_at = NOW() WHERE job_position_id = $1 AND deleted_at IS NULL`,
        [id],
      );
      await m.query(
        `UPDATE hr.job_position_kpis SET deleted_at = NOW(), updated_at = NOW() WHERE job_position_id = $1 AND deleted_at IS NULL`,
        [id],
      );
      await m.query(
        `UPDATE hr.job_position_activities SET deleted_at = NOW(), updated_at = NOW() WHERE job_position_id = $1 AND deleted_at IS NULL`,
        [id],
      );
      return hit;
    });
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'delete',
      module: 'matriz-puestos',
      entityType: 'job_position',
      entityId: removed.id,
      entityName: `${removed.code} — ${removed.title}`,
      changes: { deleted: { from: false, to: true } },
    });
  }

  private async log(
    action: 'create' | 'update' | 'approve',
    actor: Actor,
    p: PositionDetail,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      module: 'matriz-puestos',
      entityType: 'job_position',
      entityId: p.id,
      entityName: `${p.code} — ${p.title}`,
      changes,
    });
  }
}
