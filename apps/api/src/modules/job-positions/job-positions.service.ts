import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateAreaDto, CreatePositionDto, PositionQueryDto, UpdatePositionDto } from './dto/job-position.dto';
import {
  SENIORITIES,
  SENIORITY_LABELS,
  areaKey,
  canonicalLevel,
  findAreaExact,
  findAreaNear,
  normText,
  type CatalogArea,
} from './job-positions-catalog.util';
import {
  DEFAULT_LIMIT,
  escapeLike,
  POSITION_NOT_FOUND,
  VALIDATION_STATUSES,
  applyDescriptionChange,
  applyValidationChange,
  assertCanApprove,
  missingRequiredFields,
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
  SELECT p.*, u.name AS approver_name, v.name AS validator_name,
         r.full_name AS reports_to_name, r.position AS reports_to_position,
         (r.status = 'active' AND r.deleted_at IS NULL) AS reports_to_active
  FROM hr.job_positions p
  LEFT JOIN auth.users u ON u.id = p.description_approved_by
  LEFT JOIN auth.users v ON v.id = p.validated_by
  LEFT JOIN employees.employee_records r ON r.id = p.reports_to_employee_id
  WHERE p.id = $1 AND p.deleted_at IS NULL`;

type Q = { query: DataSource['query'] };

/** Campos de texto/número simples del puesto: clave del DTO → columna. */
const SIMPLE_FIELDS = {
  division: 'division',
  meotHierarchy: 'meot_hierarchy',
  reportsTo: 'reports_to_text',
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
    /** Áreas para el filtro: las del catálogo más las que ya usan puestos (para que ninguno quede sin poder filtrarse). */
    areas: string[];
    /** Catálogo de áreas con su división (alimenta el desplegable del formulario). */
    catalogAreas: { name: string; division: string | null }[];
    businessUnits: string[];
    divisions: string[];
    levels: { code: string; name: string }[];
    seniorities: { value: string; label: string }[];
    validationStatuses: readonly ValidationStatus[];
  }> {
    const distinct = async (col: 'area' | 'business_unit' | 'level' | 'division'): Promise<string[]> => {
      const rows = (await this.dataSource.query(
        `SELECT DISTINCT ${col} AS v FROM hr.job_positions
         WHERE deleted_at IS NULL AND ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col} ASC`,
      )) as { v: string }[];
      return rows.map((r) => r.v);
    };
    const [usedAreas, businessUnits, divisions, levelRows, areaRows] = await Promise.all([
      distinct('area'),
      distinct('business_unit'),
      distinct('division'),
      this.dataSource.query(`SELECT code, name FROM catalogs.org_levels WHERE is_active IS NOT FALSE ORDER BY sort_order`) as Promise<{ code: string; name: string }[]>,
      this.dataSource.query(`SELECT name, division_name FROM catalogs.areas WHERE is_active IS NOT FALSE ORDER BY name`) as Promise<{ name: string; division_name: string | null }[]>,
    ]);
    const catalogAreas = areaRows.map((r) => ({ name: r.name, division: r.division_name }));
    const seen = new Set<string>();
    const areas = [...catalogAreas.map((a) => a.name), ...usedAreas]
      .filter((a) => (seen.has(areaKey(a)) ? false : (seen.add(areaKey(a)), true)))
      .sort((a, b) => a.localeCompare(b, 'es'));
    return {
      areas,
      catalogAreas,
      businessUnits,
      divisions,
      levels: levelRows,
      seniorities: SENIORITIES.map((s) => ({ value: s, label: SENIORITY_LABELS[s] })),
      validationStatuses: VALIDATION_STATUSES,
    };
  }

  async list(q: PositionQueryDto): Promise<PositionPage> {
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_LIMIT;
    const { where, params } = buildPositionWhere({
      area: q.area,
      businessUnit: q.businessUnit,
      division: q.division,
      level: q.level,
      seniority: q.seniority,
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
      this.assertRequired({ roleSummary: dto.roleSummary, positionObjective: dto.positionObjective, validationPoints: dto.validationPoints, description });
      if (dto.reportsToEmployeeId) await this.assertActiveEmployee(m, dto.reportsToEmployeeId);
      const status = resolveStatus((dto.status as PositionStatus | undefined) ?? 'activo', { description, approved: false });
      // Nivel y Área son listas cerradas: se validan contra el catálogo y se guarda el nombre canónico.
      const lists = await this.resolveCatalogs(m, { level: dto.level ?? null, area: dto.area.trim(), division: dto.division ?? null }, null);
      const rows = (await m.query(
        `INSERT INTO hr.job_positions (code, title, area, business_unit, level, description, status, created_by,
           division, meot_hierarchy, reports_to_text, plazas, role_summary, position_objective, validation_points, seniority,
           reports_to_employee_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          code, dto.title.trim(), lists.area, dto.businessUnit ?? null, lists.level, description, status, actor.id ?? null,
          dto.division ?? null, dto.meotHierarchy ?? null, dto.reportsTo ?? null, dto.plazas ?? null,
          dto.roleSummary ?? null, dto.positionObjective ?? null, dto.validationPoints ?? null, dto.seniority ?? null,
          dto.reportsToEmployeeId ?? null,
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
      // Nivel y Área: solo se revalidan contra el catálogo si cambiaron (un puesto antiguo con un valor fuera de catálogo sigue editable).
      const lists = await this.resolveCatalogs(
        m,
        { level: next.level ?? null, area: next.area, division: (simple.division as string | null) ?? null },
        { level: cur.level, area: cur.area, division: cur.division },
      );
      next.level = lists.level;
      next.area = lists.area;
      const seniority = dto.seniority !== undefined ? dto.seniority : cur.seniority;
      // Los campos obligatorios se exigen al guardar el formulario; cambiar solo la validación del Head no se bloquea.
      // (el DTO ya validado trae todas las propiedades; solo cuentan las que llegaron con valor)
      const touchesForm = Object.entries(dto).some(([k, v]) => v !== undefined && k !== 'validationStatus' && k !== 'headComments');
      if (touchesForm) {
        this.assertRequired({
          roleSummary: simple.roleSummary as string | null,
          positionObjective: simple.positionObjective as string | null,
          validationPoints: simple.validationPoints as string | null,
          description: desc.description,
        });
      }
      const reportsToEmployeeId = dto.reportsToEmployeeId !== undefined ? dto.reportsToEmployeeId : cur.reports_to_employee_id;
      if (reportsToEmployeeId && reportsToEmployeeId !== cur.reports_to_employee_id) await this.assertActiveEmployee(m, reportsToEmployeeId);
      const validation = applyValidationChange(
        { status: cur.validation_status, by: cur.validated_by, at: cur.validated_at },
        dto.validationStatus,
        actor.id ?? null,
        new Date(),
      );
      await m.query(
        `UPDATE hr.job_positions SET title=$2, area=$3, business_unit=$4, level=$5, description=$6,
           description_approved=$7, description_approved_by=$8, description_approved_at=$9,
           status=$10, division=$11, meot_hierarchy=$12, reports_to_text=$13, plazas=$14,
           role_summary=$15, position_objective=$16, validation_points=$17, head_comments=$18,
           validation_status=$19, validated_by=$20, validated_at=$21, seniority=$22, reports_to_employee_id=$23, updated_at=NOW()
         WHERE id=$1`,
        [
          id, next.title, next.area, next.business_unit, next.level, desc.description, desc.approved, desc.approvedBy, desc.approvedAt, status,
          simple.division, simple.meotHierarchy, simple.reportsTo, simple.plazas,
          simple.roleSummary, simple.positionObjective, simple.validationPoints, simple.headComments,
          validation.status, validation.by, validation.at, seniority, reportsToEmployeeId ?? null,
        ],
      );

      const diff: Record<string, { from: unknown; to: unknown }> = {};
      if (cur.title !== next.title) diff.title = { from: cur.title, to: next.title };
      if (cur.area !== next.area) diff.area = { from: cur.area, to: next.area };
      if (cur.business_unit !== next.business_unit) diff.businessUnit = { from: cur.business_unit, to: next.business_unit };
      if (cur.level !== next.level) diff.level = { from: cur.level, to: next.level };
      if (cur.seniority !== seniority) diff.seniority = { from: cur.seniority, to: seniority };
      if (cur.status !== status) diff.status = { from: cur.status, to: status };
      for (const key of Object.keys(SIMPLE_FIELDS) as SimpleKey[]) {
        const before = (cur as unknown as Record<string, unknown>)[SIMPLE_FIELDS[key]] ?? null;
        const after = simple[key] ?? null;
        if (before !== after) diff[key] = LONG_TEXT.has(key) ? { from: 'modificado', to: 'modificado' } : { from: before, to: after };
      }
      if (cur.validation_status !== validation.status) diff.validationStatus = { from: cur.validation_status, to: validation.status };
      if ((cur.reports_to_employee_id ?? null) !== (reportsToEmployeeId ?? null)) {
        diff.reportsToEmployee = { from: await this.employeeName(m, cur.reports_to_employee_id), to: await this.employeeName(m, reportsToEmployeeId ?? null) };
      }
      // El texto de la descripción no se guarda en la bitácora: solo que cambió y si se invalidó la aprobación.
      if (cur.description !== desc.description) diff.description = { from: 'modificada', to: 'modificada' };
      if (cur.description_approved && !desc.approved) diff.descriptionApproved = { from: true, to: false };
      return diff;
    });
    const detail = await this.getDetail(id);
    await this.log('update', actor, detail, changes);
    return detail;
  }

  /** 400 con un mensaje por cada campo obligatorio vacío. */
  private assertRequired(values: Parameters<typeof missingRequiredFields>[0]): void {
    const missing = missingRequiredFields(values);
    if (missing.length > 0) throw new BadRequestException(missing.map((f) => f.message));
  }

  /** «Reporta a» solo puede ser un empleado activo y no eliminado. */
  private async assertActiveEmployee(m: Q, employeeId: string): Promise<void> {
    const rows = (await m.query(
      `SELECT 1 FROM employees.employee_records WHERE id = $1 AND status = 'active' AND deleted_at IS NULL`,
      [employeeId],
    )) as unknown[];
    if (!rows[0]) throw new BadRequestException('El empleado de «Reporta a» no existe o no está activo');
  }

  private async employeeName(m: Q, employeeId: string | null): Promise<string | null> {
    if (!employeeId) return null;
    const rows = (await m.query(`SELECT full_name FROM employees.employee_records WHERE id = $1`, [employeeId])) as { full_name: string }[];
    return rows[0]?.full_name ?? employeeId;
  }

  /**
   * Buscador ligero para «Reporta a»: empleados activos por nombre, sin distinguir mayúsculas ni acentos (mínimo 2 letras, máximo 10 resultados) con
   * solo id, nombre, cargo y área (nada de correo, nómina ni datos personales).
   */
  async searchEmployees(q: string, limit = 10): Promise<{ id: string; fullName: string; position: string; area: string | null }[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const rows = (await this.dataSource.query(
      `SELECT id, full_name, position, area FROM employees.employee_records
       WHERE status = 'active' AND deleted_at IS NULL
         AND translate(lower(full_name), 'áéíóúüñ', 'aeiouun') LIKE translate(lower($1), 'áéíóúüñ', 'aeiouun')
       ORDER BY full_name ASC LIMIT $2`,
      [`%${escapeLike(term)}%`, Math.min(Math.max(limit, 1), 10)],
    )) as { id: string; full_name: string; position: string; area: string | null }[];
    return rows.map((r) => ({ id: r.id, fullName: r.full_name, position: r.position, area: r.area }));
  }

  /**
   * Nivel y Área son listas cerradas. El nivel debe estar en `catalogs.org_levels` y el área en
   * `catalogs.areas` de la división (comparación sin mayúsculas, acentos ni espacios extra); se devuelve el
   * valor canónico del catálogo. Solo se valida lo que cambió respecto del puesto actual (`cur`).
   */
  private async resolveCatalogs(
    m: Q,
    input: { level: string | null; area: string; division: string | null },
    cur: { level: string | null; area: string; division: string | null } | null,
  ): Promise<{ level: string | null; area: string }> {
    let level = input.level && input.level.trim() !== '' ? input.level.trim() : null;
    if (level !== null) {
      const codes = ((await m.query(`SELECT code FROM catalogs.org_levels WHERE is_active IS NOT FALSE ORDER BY sort_order`)) as { code: string }[]).map((r) => r.code);
      const canonical = canonicalLevel(level, codes);
      if (canonical) level = canonical;
      else if (!cur || normText(cur.level) !== normText(level)) {
        throw new BadRequestException(`El nivel debe ser uno de la lista: ${codes.join(', ')}`);
      }
    }

    let area = input.area;
    const areaChanged = !cur || areaKey(cur.area) !== areaKey(area) || normText(cur.division) !== normText(input.division);
    if (areaChanged) {
      const areas = await this.catalogAreas(m);
      const hit = input.division
        ? findAreaExact(areas, input.division, area)
        : (areas.find((a) => areaKey(a.name) === areaKey(area)) ?? null);
      if (!hit) {
        throw new BadRequestException(
          input.division
            ? `El área «${area}» no está en el catálogo de la división «${input.division}». Elige una de la lista o agrega el área nueva.`
            : `El área «${area}» no está en el catálogo de áreas. Elige una de la lista o agrega el área nueva.`,
        );
      }
      area = hit.name;
    }
    return { level, area };
  }

  private async catalogAreas(m: Q): Promise<CatalogArea[]> {
    const rows = (await m.query(`SELECT name, division_name FROM catalogs.areas WHERE is_active IS NOT FALSE`)) as { name: string; division_name: string | null }[];
    return rows.map((r) => ({ name: r.name, divisionName: r.division_name }));
  }

  /**
   * Agrega un área al catálogo (permiso `update` de la Matriz). Compara con las existentes de la división sin
   * mayúsculas, acentos ni espacios extra: si ya hay una igual se devuelve esa (no se crea); si hay una casi
   * igual se responde 409 con la sugerencia, salvo que `confirmSimilar` diga que es otra distinta.
   */
  async createArea(dto: CreateAreaDto, actor: Actor): Promise<{ created: boolean; area: { name: string; division: string } }> {
    const name = dto.name.replace(/\s+/g, ' ').trim();
    const division = dto.division.trim();
    if (areaKey(name) === '') throw new BadRequestException('El nombre del área es obligatorio');
    const result = await this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('catalogs.areas'))`);
      const areas = await this.catalogAreas(m);
      const exact = findAreaExact(areas, division, name);
      if (exact) return { created: false, area: { name: exact.name, division } };
      const near = findAreaNear(areas, division, name);
      if (near && !dto.confirmSimilar) {
        throw new ConflictException({ message: `Ya existe un área parecida: «${near.name}». Usa esa o confirma que es otra distinta.`, suggestion: near.name });
      }
      await m.query(`INSERT INTO catalogs.areas (name, division_name, is_active) VALUES ($1, $2, true)`, [name, division]);
      return { created: true, area: { name, division } };
    });
    if (result.created) {
      await this.audit.logActivity({
        userId: actor.id ?? null,
        userEmail: actor.email ?? null,
        userName: actor.name ?? null,
        action: 'create',
        module: 'matriz-puestos',
        entityType: 'catalog_area',
        entityName: `${division} · ${name}`,
        changes: { name: { from: null, to: name }, division: { from: null, to: division } },
      });
    }
    return result;
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
