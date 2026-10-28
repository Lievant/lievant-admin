import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import ExcelJS from 'exceljs';
import { AuditService } from '../audit/audit.service';
import type { Actor } from './job-positions.service';
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  norm,
  parseMatrixSheets,
  type ColumnKey,
  type ImportIssue,
  type ParsedPosition,
  type ParseResult,
  type RawSheet,
} from './job-positions-import.parser';
import { findAreaExact, type CatalogArea } from './job-positions-catalog.util';
import { applyValidationChange, nextPositionCode, type ValidationStatus } from './job-positions.util';

type Q = { query: DataSource['query'] };

export type ImportAction = 'crear' | 'actualizar' | 'sin cambios';

export interface ImportPositionPreview {
  row: number;
  title: string;
  area: string;
  action: ImportAction;
  activities: number;
  okrRows: number;
  objectives: number;
  kpis: number;
}

export interface ImportSummary {
  positions: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Áreas que no estaban en el catálogo y se agregan al aplicar. */
  newAreas: number;
  plazas: number;
  areas: number;
  groups: number;
  activities: number;
  activitiesWithNote: number;
  objectives: number;
  okrRows: number;
  kpis: number;
}

export interface ImportResult {
  mode: 'preview' | 'apply';
  /** Solo `apply` sin errores bloqueantes escribe en la base. */
  applied: boolean;
  fileName: string;
  sheet: string | null;
  division: string;
  divisionHint: string | null;
  positions: ImportPositionPreview[];
  /** Nombres (canónicos) de las áreas nuevas que se agregarán al catálogo. */
  newAreas: string[];
  summary: ImportSummary;
  warnings: ImportIssue[];
  errors: ImportIssue[];
}

interface ExistingPosition {
  id: string;
  code: string;
  title: string;
  area: string;
  division: string | null;
  level: string | null;
  level_original: string | null;
  seniority: string | null;
  meot_hierarchy: string | null;
  reports_to_text: string | null;
  supervises_text: string | null;
  plazas: number | null;
  role_summary: string | null;
  position_objective: string | null;
  validation_points: string | null;
  head_comments: string | null;
  validation_status: ValidationStatus;
  validated_by: string | null;
  validated_at: Date | null;
}

interface ExistingActivity { group_order: number; group_title: string; sort_order: number; description: string; frequency: string | null; note: string | null }
interface ExistingOkr { id: string; objective_code: string | null; kr_code: string | null; objective: string; key_result: string; sort_order: number }
interface ExistingKpi { id: string; name: string; description: string | null; target_value: string | null; measurement_frequency: string | null }

/** Qué hay que hacer con un puesto del archivo. */
interface Plan {
  action: ImportAction;
  existing: ExistingPosition | null;
  simple: Partial<Record<string, unknown>>;
  validation: { status: ValidationStatus; by: string | null; at: Date | null } | null;
  headComments: { value: string } | null;
  replaceActivities: boolean;
  okrUpdates: { id: string; okr: ParsedPosition['okrs'][number] }[];
  okrInserts: ParsedPosition['okrs'];
  okrDeletes: string[];
  kpiUpdates: { id: string; kpi: ParsedPosition['kpis'][number] }[];
  kpiInserts: ParsedPosition['kpis'];
  kpiDeletes: string[];
}

const same = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null);

const SIMPLE_MAP: { column: ColumnKey; field: keyof ParsedPosition; col: keyof ExistingPosition }[] = [
  { column: 'meot', field: 'meotHierarchy', col: 'meot_hierarchy' },
  { column: 'reportsTo', field: 'reportsTo', col: 'reports_to_text' },
  { column: 'supervises', field: 'supervises', col: 'supervises_text' },
  { column: 'plazas', field: 'plazas', col: 'plazas' },
  { column: 'role', field: 'roleSummary', col: 'role_summary' },
  { column: 'objective', field: 'positionObjective', col: 'position_objective' },
  { column: 'validationPoints', field: 'validationPoints', col: 'validation_points' },
];

const identity = (division: string, area: string, title: string): string => `${norm(division)}|${norm(area)}|${norm(title)}`;

/**
 * Importación de la Matriz de Puestos desde el Excel de una división. `preview` solo lee; `apply` escribe todo en
 * una transacción (todo o nada). El archivo se vuelve a leer en cada llamada: no hay estado en el servidor.
 */
@Injectable()
export class JobPositionsImportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** Valida el archivo (firma ZIP, tamaño) y lo convierte en filas de texto por hoja. */
  async readWorkbook(file: { buffer: Buffer; originalname: string; size: number } | undefined): Promise<RawSheet[]> {
    if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException('No se recibió ningún archivo o está vacío.');
    if (file.buffer.length > MAX_IMPORT_BYTES) throw new BadRequestException('El archivo pasa de 5 MB.');
    if (!/\.xlsx$/i.test(file.originalname) || file.buffer.subarray(0, 4).toString('hex') !== '504b0304') {
      throw new BadRequestException('El archivo debe ser un Excel .xlsx.');
    }
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo: no es un Excel .xlsx válido.');
    }
    const sheets: RawSheet[] = wb.worksheets.map((ws) => {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          cells[col - 1] = cellText(cell.value);
        });
        rows[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
      });
      return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
    });
    const total = sheets.reduce((n, s) => Math.max(n, s.rows.length), 0);
    if (total > MAX_IMPORT_ROWS + 20) throw new BadRequestException(`El archivo pasa del límite de ${MAX_IMPORT_ROWS} filas.`);
    return sheets;
  }

  async run(
    mode: 'preview' | 'apply',
    division: string,
    file: { buffer: Buffer; originalname: string; size: number } | undefined,
    actor: Actor,
  ): Promise<ImportResult> {
    const sheets = await this.readWorkbook(file);
    const levelCodes = await this.levelCodes(this.dataSource);
    const parsed = parseMatrixSheets(sheets, { levelCodes });
    if (parsed.dataRows > MAX_IMPORT_ROWS) throw new BadRequestException(`El archivo pasa del límite de ${MAX_IMPORT_ROWS} filas.`);
    const fileName = file?.originalname ?? '';
    const div = division.trim();

    if (parsed.errors.length > 0) return this.result(mode, false, fileName, div, parsed, [], new Map(), []);

    if (mode === 'preview') {
      const areas = await this.resolveAreas(this.dataSource, parsed, div, false);
      const plans = await this.plan(this.dataSource, areas.parsed, div, actor);
      return this.result(mode, false, fileName, div, areas.parsed, areas.parsed.positions, plans, areas.created);
    }

    const { plans, areas } = await this.dataSource.transaction(async (m) => {
      // Mismo candado que el alta de puestos: dos importaciones (o un alta) simultáneas no repiten códigos.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('hr.job_positions.code'))`);
      // Las áreas nuevas se crean en la misma transacción: si algo falla, tampoco queda el área.
      const areas = await this.resolveAreas(m, parsed, div, true);
      const plans = await this.plan(m, areas.parsed, div, actor);
      const codes = ((await m.query(`SELECT code FROM hr.job_positions`)) as { code: string }[]).map((c) => c.code);
      for (const p of areas.parsed.positions) {
        const plan = plans.get(p.row)!;
        if (plan.action === 'sin cambios') continue;
        const code = plan.action === 'crear' ? nextPositionCode(codes) : plan.existing!.code;
        if (plan.action === 'crear') codes.push(code);
        await this.write(m, p, plan, div, code, areas.parsed.columns, actor);
      }
      return { plans, areas };
    });
    const result = this.result(mode, true, fileName, div, areas.parsed, areas.parsed.positions, plans, areas.created);
    for (const name of areas.created) {
      await this.audit.logActivity({
        userId: actor.id ?? null,
        userEmail: actor.email ?? null,
        userName: actor.name ?? null,
        action: 'create',
        module: 'matriz-puestos',
        entityType: 'catalog_area',
        entityName: `${div} · ${name}`,
        changes: { name: { from: null, to: name }, division: { from: null, to: div }, source: { from: null, to: 'importación' } },
      });
    }
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action: 'import',
      module: 'matriz-puestos',
      entityType: 'job_position_import',
      entityName: fileName,
      changes: {
        fileName: { from: null, to: fileName },
        division: { from: null, to: div },
        created: { from: null, to: result.summary.created },
        updated: { from: null, to: result.summary.updated },
        unchanged: { from: null, to: result.summary.unchanged },
        newAreas: { from: null, to: result.summary.newAreas },
      },
    });
    return result;
  }

  private async levelCodes(m: Q): Promise<string[]> {
    const rows = (await m.query(`SELECT code FROM catalogs.org_levels WHERE is_active IS NOT FALSE ORDER BY sort_order`)) as { code: string }[];
    return rows.map((r) => r.code);
  }

  /**
   * Compara cada Sub-área del archivo con el catálogo de áreas de la división (sin mayúsculas, acentos ni espacios
   * extra): si existe usa su nombre canónico; si no, es un área nueva (aviso) que se agrega al catálogo cuando `create`.
   * Dos escrituras distintas de la misma área nueva («Marketplace» y «marketplace ») cuentan como una sola.
   */
  private async resolveAreas(m: Q, parsed: ParseResult, division: string, create: boolean): Promise<{ parsed: ParseResult; created: string[] }> {
    if (create) await m.query(`SELECT pg_advisory_xact_lock(hashtext('catalogs.areas'))`);
    const rows = (await m.query(`SELECT name, division_name FROM catalogs.areas WHERE is_active IS NOT FALSE`)) as { name: string; division_name: string | null }[];
    const catalog: CatalogArea[] = rows.map((r) => ({ name: r.name, divisionName: r.division_name }));
    const created: string[] = [];
    const warnings = [...parsed.warnings];
    const positions = parsed.positions.map((p) => {
      const hit = findAreaExact(catalog, division, p.area);
      if (hit) return { ...p, area: hit.name };
      // Área nueva: el primer nombre con que aparece es el canónico.
      catalog.push({ name: p.area, divisionName: division });
      created.push(p.area);
      warnings.push({ row: p.row, message: `Área nueva «${p.area}»: se agregará al catálogo de áreas` });
      return p;
    });
    if (create) {
      for (const name of created) {
        await m.query(`INSERT INTO catalogs.areas (name, division_name, is_active) VALUES ($1, $2, true)`, [name, division]);
      }
    }
    return { parsed: { ...parsed, positions, warnings }, created };
  }

  // ── Plan ───────────────────────────────────────────────────────────────────

  private async plan(m: Q, parsed: ParseResult, division: string, actor: Actor): Promise<Map<number, Plan>> {
    const existingAll = (await m.query(`SELECT * FROM hr.job_positions WHERE deleted_at IS NULL`)) as ExistingPosition[];
    const byIdentity = new Map(existingAll.map((e) => [identity(e.division ?? '', e.area, e.title), e]));
    const plans = new Map<number, Plan>();
    for (const p of parsed.positions) {
      const existing = byIdentity.get(identity(division, p.area, p.title)) ?? null;
      plans.set(p.row, existing ? await this.planUpdate(m, p, existing, parsed.columns, actor) : this.planCreate(p, actor));
    }
    return plans;
  }

  private planCreate(p: ParsedPosition, actor: Actor): Plan {
    const validation = applyValidationChange({ status: 'pendiente', by: null, at: null }, p.validationStatus, actor.id ?? null, new Date());
    return {
      action: 'crear',
      existing: null,
      simple: {},
      validation,
      headComments: p.headComments ? { value: p.headComments } : null,
      replaceActivities: p.activities.length > 0,
      okrUpdates: [],
      okrInserts: p.okrs,
      okrDeletes: [],
      kpiUpdates: [],
      kpiInserts: p.kpis,
      kpiDeletes: [],
    };
  }

  private async planUpdate(m: Q, p: ParsedPosition, e: ExistingPosition, columns: ReadonlySet<ColumnKey>, actor: Actor): Promise<Plan> {
    const simple: Record<string, unknown> = {};
    if (!same(e.title, p.title)) simple.title = p.title;
    if (!same(e.area, p.area)) simple.area = p.area;
    for (const f of SIMPLE_MAP) {
      if (columns.has(f.column) && !same(e[f.col], p[f.field])) simple[f.col] = p[f.field];
    }

    // El estatus y los comentarios del Head del sistema solo se pisan si el archivo trae algo.
    // Nivel: un valor ambiguo del Excel (rango, «Sin nivel»…) no pisa un nivel ya elegido a mano ni cuenta como cambio.
    if (columns.has('level')) {
      if (p.levelAmbiguous && e.level !== null) {
        // se conserva el nivel y su texto original tal cual
      } else {
        if (!same(e.level, p.level)) simple.level = p.level;
        if (!same(e.level_original, p.levelOriginal)) simple.level_original = p.levelOriginal;
      }
    }
    // Categoría: solo si la jerarquía (MEOT) del archivo trae una; si no, se conserva la del sistema.
    if (columns.has('meot') && p.seniority !== null && p.seniority !== e.seniority) simple.seniority = p.seniority;

    let validation: Plan['validation'] = null;
    if (columns.has('status') && p.validationStatus !== 'pendiente' && p.validationStatus !== e.validation_status) {
      validation = applyValidationChange({ status: e.validation_status, by: e.validated_by, at: e.validated_at }, p.validationStatus, actor.id ?? null, new Date());
    }
    const headComments = columns.has('comments') && p.headComments && p.headComments !== e.head_comments ? { value: p.headComments } : null;

    let replaceActivities = false;
    if (columns.has('activities')) {
      const cur = (await m.query(
        `SELECT group_order, group_title, sort_order, description, frequency, note FROM hr.job_position_activities
         WHERE job_position_id = $1 AND deleted_at IS NULL ORDER BY group_order, sort_order, created_at`,
        [e.id],
      )) as ExistingActivity[];
      const a = JSON.stringify(cur.map((x) => [x.group_order, x.group_title, x.sort_order, x.description, x.frequency, x.note]));
      const b = JSON.stringify(p.activities.map((x) => [x.groupOrder, x.groupTitle, x.sortOrder, x.description, x.frequency, x.note]));
      replaceActivities = a !== b;
    }

    const okrUpdates: Plan['okrUpdates'] = [];
    const okrInserts: Plan['okrInserts'] = [];
    const okrDeletes: string[] = [];
    if (columns.has('okrs')) {
      const cur = (await m.query(
        `SELECT id, objective_code, kr_code, objective, key_result, sort_order FROM hr.job_position_okrs
         WHERE job_position_id = $1 AND period IS NULL AND deleted_at IS NULL ORDER BY sort_order, created_at`,
        [e.id],
      )) as ExistingOkr[];
      const byKey = new Map(cur.filter((o) => o.objective_code && o.kr_code).map((o) => [`${o.objective_code}|${o.kr_code}`, o]));
      const used = new Set<string>();
      for (const okr of p.okrs) {
        const match = byKey.get(`${okr.objectiveCode}|${okr.krCode}`);
        if (match && !used.has(match.id)) {
          used.add(match.id);
          if (match.objective !== okr.objective || match.key_result !== okr.keyResult || match.sort_order !== okr.sortOrder) okrUpdates.push({ id: match.id, okr });
        } else okrInserts.push(okr);
      }
      for (const o of cur) if (!used.has(o.id)) okrDeletes.push(o.id);
    }

    const kpiUpdates: Plan['kpiUpdates'] = [];
    const kpiInserts: Plan['kpiInserts'] = [];
    const kpiDeletes: string[] = [];
    if (columns.has('kpis')) {
      const cur = (await m.query(
        `SELECT id, name, description, target_value, measurement_frequency FROM hr.job_position_kpis
         WHERE job_position_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [e.id],
      )) as ExistingKpi[];
      const pool = new Map<string, ExistingKpi[]>();
      for (const k of cur) pool.set(norm(k.name), [...(pool.get(norm(k.name)) ?? []), k]);
      const used = new Set<string>();
      for (const kpi of p.kpis) {
        const match = pool.get(norm(kpi.name))?.shift();
        if (match) {
          used.add(match.id);
          if (match.name !== kpi.name || !same(match.description, kpi.description) || !same(match.target_value, kpi.targetValue) || !same(match.measurement_frequency, kpi.frequency)) {
            kpiUpdates.push({ id: match.id, kpi });
          }
        } else kpiInserts.push(kpi);
      }
      for (const k of cur) if (!used.has(k.id)) kpiDeletes.push(k.id);
    }

    const changed =
      Object.keys(simple).length > 0 || validation !== null || headComments !== null || replaceActivities ||
      okrUpdates.length + okrInserts.length + okrDeletes.length + kpiUpdates.length + kpiInserts.length + kpiDeletes.length > 0;
    return {
      action: changed ? 'actualizar' : 'sin cambios',
      existing: e,
      simple,
      validation,
      headComments,
      replaceActivities,
      okrUpdates,
      okrInserts,
      okrDeletes,
      kpiUpdates,
      kpiInserts,
      kpiDeletes,
    };
  }

  // ── Escritura (dentro de la transacción de `apply`) ────────────────────────

  private async write(m: Q, p: ParsedPosition, plan: Plan, division: string, code: string, columns: ReadonlySet<ColumnKey>, actor: Actor): Promise<void> {
    let positionId: string;
    if (plan.action === 'crear') {
      // `description` queda vacía y `status` activo: la descripción formal se redacta y aprueba aparte.
      const rows = (await m.query(
        `INSERT INTO hr.job_positions (code, title, area, level, status, created_by, division, meot_hierarchy, reports_to_text,
           supervises_text, plazas, role_summary, position_objective, validation_points, head_comments,
           validation_status, validated_by, validated_at, level_original, seniority)
         VALUES ($1,$2,$3,$4,'activo',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [
          code, p.title, p.area, p.level, actor.id ?? null, division, p.meotHierarchy, p.reportsTo, p.supervises, p.plazas,
          p.roleSummary, p.positionObjective, p.validationPoints, plan.headComments?.value ?? null,
          plan.validation?.status ?? 'pendiente', plan.validation?.by ?? null, plan.validation?.at ?? null,
          p.levelOriginal, p.seniority,
        ],
      )) as { id: string }[];
      positionId = rows[0]!.id;
    } else {
      positionId = plan.existing!.id;
      const sets: string[] = [];
      const params: unknown[] = [positionId];
      const add = (col: string, value: unknown) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      };
      // Nunca se tocan description, description_approved*, status ni business_unit.
      for (const [col, value] of Object.entries(plan.simple)) add(col, value);
      if (plan.validation) {
        add('validation_status', plan.validation.status);
        add('validated_by', plan.validation.by);
        add('validated_at', plan.validation.at);
      }
      if (plan.headComments) add('head_comments', plan.headComments.value);
      if (sets.length > 0) await m.query(`UPDATE hr.job_positions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
    }

    if (plan.replaceActivities || (plan.action === 'crear' && columns.has('activities'))) {
      await m.query(`UPDATE hr.job_position_activities SET deleted_at = NOW(), updated_at = NOW() WHERE job_position_id = $1 AND deleted_at IS NULL`, [positionId]);
      for (const a of p.activities) {
        await m.query(
          `INSERT INTO hr.job_position_activities (job_position_id, group_order, group_title, sort_order, description, frequency, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [positionId, a.groupOrder, a.groupTitle, a.sortOrder, a.description, a.frequency, a.note],
        );
      }
    }

    for (const u of plan.okrUpdates) {
      await m.query(
        `UPDATE hr.job_position_okrs SET objective = $2, key_result = $3, sort_order = $4, updated_at = NOW() WHERE id = $1`,
        [u.id, u.okr.objective, u.okr.keyResult, u.okr.sortOrder],
      );
    }
    for (const id of plan.okrDeletes) {
      await m.query(`UPDATE hr.job_position_okrs SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    }
    for (const o of plan.okrInserts) {
      // Plantilla: sin periodo y sin peso.
      await m.query(
        `INSERT INTO hr.job_position_okrs (job_position_id, period, objective_code, kr_code, objective, key_result, weight, sort_order, is_active)
         VALUES ($1, NULL, $2, $3, $4, $5, NULL, $6, true)`,
        [positionId, o.objectiveCode, o.krCode, o.objective, o.keyResult, o.sortOrder],
      );
    }

    for (const u of plan.kpiUpdates) {
      await m.query(
        `UPDATE hr.job_position_kpis SET name = $2, description = $3, target_value = $4, measurement_frequency = $5, updated_at = NOW() WHERE id = $1`,
        [u.id, u.kpi.name, u.kpi.description, u.kpi.targetValue, u.kpi.frequency],
      );
    }
    for (const id of plan.kpiDeletes) {
      await m.query(`UPDATE hr.job_position_kpis SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    }
    for (const k of plan.kpiInserts) {
      await m.query(
        `INSERT INTO hr.job_position_kpis (job_position_id, name, description, target_value, measurement_frequency, is_active)
         VALUES ($1,$2,$3,$4,$5,true)`,
        [positionId, k.name, k.description, k.targetValue, k.frequency],
      );
    }
  }

  // ── Respuesta ──────────────────────────────────────────────────────────────

  private result(
    mode: 'preview' | 'apply',
    applied: boolean,
    fileName: string,
    division: string,
    parsed: ParseResult,
    positions: ParsedPosition[],
    plans: Map<number, Plan>,
    newAreas: string[],
  ): ImportResult {
    const rows: ImportPositionPreview[] = positions.map((p) => ({
      row: p.row,
      title: p.title,
      area: p.area,
      action: plans.get(p.row)?.action ?? 'sin cambios',
      activities: p.activities.length,
      okrRows: p.okrs.length,
      objectives: new Set(p.okrs.map((o) => o.objectiveCode)).size,
      kpis: p.kpis.length,
    }));
    const count = (a: ImportAction) => rows.filter((r) => r.action === a).length;
    const groups = positions.reduce((n, p) => n + new Set(p.activities.map((a) => `${a.groupOrder}|${a.groupTitle}`)).size, 0);
    const summary: ImportSummary = {
      positions: rows.length,
      created: count('crear'),
      updated: count('actualizar'),
      unchanged: count('sin cambios'),
      newAreas: newAreas.length,
      plazas: positions.reduce((n, p) => n + (p.plazas ?? 0), 0),
      areas: new Set(positions.map((p) => norm(p.area))).size,
      groups,
      activities: positions.reduce((n, p) => n + p.activities.length, 0),
      activitiesWithNote: positions.reduce((n, p) => n + p.activities.filter((a) => a.note).length, 0),
      objectives: positions.reduce((n, p) => n + new Set(p.okrs.map((o) => o.objectiveCode)).size, 0),
      okrRows: positions.reduce((n, p) => n + p.okrs.length, 0),
      kpis: positions.reduce((n, p) => n + p.kpis.length, 0),
    };
    return {
      mode,
      applied,
      fileName,
      sheet: parsed.sheetName,
      division,
      divisionHint: parsed.divisionHint,
      positions: rows,
      newAreas,
      summary,
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }
}

/** Texto de una celda de ExcelJS (texto enriquecido, fórmulas, hipervínculos, números y fechas). */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((r) => r.text).join('');
    if ('result' in v && v.result !== undefined && v.result !== null) return cellText(v.result as ExcelJS.CellValue);
    if (typeof v.text === 'string') return v.text;
  }
  return '';
}
