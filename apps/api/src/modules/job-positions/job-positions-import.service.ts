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
import { canonicalDivision, divisionNotInCatalog, loadCatalogDivisions } from './job-positions-divisions';
import { deduceDivision } from './job-positions-import.parser';
import { findAreaExact, type CatalogArea } from './job-positions-catalog.util';
import { resolveImportRelations, type RelFileRow, type RowRelations } from './job-positions-import.relations';
import { applyValidationChange, assertPeriod, missingRequiredFields, nextPositionCode, splitWeights, MAX_WEIGHT_SUM, type ValidationStatus } from './job-positions.util';

type Q = { query: DataSource['query'] };

export type ImportAction = 'crear' | 'actualizar' | 'sin cambios';

/** Un OKR del semestre elegido tal como quedará: los nuevos con el peso repartido, los existentes con su peso (no cambia). */
export interface ImportOkrPreview {
  objectiveCode: string;
  krCode: string;
  weight: number;
  isNew: boolean;
}

export interface ImportPositionPreview {
  row: number;
  title: string;
  area: string;
  action: ImportAction;
  activities: number;
  okrRows: number;
  objectives: number;
  kpis: number;
  /** OKRs del semestre elegido con su peso (solo si el archivo trae la columna de OKRs). */
  okrs: ImportOkrPreview[];
  /** «Reporta a» y «Supervisa a» resueltos (títulos de los puestos enlazados); null si el archivo no trae la columna. */
  relations: { reportsTo: string | null; reportsToText: string | null; supervises: string[]; supervisesUnresolved: string[] } | null;
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
  /** Semestre (AAAA-S1/S2) en el que se crean y se comparan los OKRs. */
  period: string;
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
  description: string | null;
  reports_to_text: string | null;
  reports_to_position_id: string | null;
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
interface ExistingOkr { id: string; objective_code: string | null; kr_code: string | null; objective: string; key_result: string; sort_order: number; weight: string | number; is_active: boolean }

/** OKR nuevo del archivo con el peso entero que le tocó en el reparto. */
type NewOkr = ParsedPosition['okrs'][number] & { weight: number };
interface ExistingKpi { id: string; name: string; description: string | null; target_value: string | null; measurement_frequency: string | null }

/** Qué hay que hacer con un puesto del archivo. */
interface Plan {
  action: ImportAction;
  /** Campos obligatorios del formulario que el puesto no tendría tras la importación (aviso, no error). */
  missing: string[];
  existing: ExistingPosition | null;
  simple: Partial<Record<string, unknown>>;
  validation: { status: ValidationStatus; by: string | null; at: Date | null } | null;
  headComments: { value: string } | null;
  replaceActivities: boolean;
  okrUpdates: { id: string; okr: ParsedPosition['okrs'][number] }[];
  okrInserts: NewOkr[];
  okrDeletes: string[];
  /** Los OKRs del semestre como quedarán (para la vista previa). */
  okrView: ImportOkrPreview[];
  /** El semestre no tiene peso suficiente para darle 1 a cada OKR nuevo (bloquea la importación). */
  weightError: string | null;
  /** «Reporta a» y «Supervisa a» resueltos contra los puestos de la división (se llena después de planear todos). */
  relations: RowRelations | null;
  kpiUpdates: { id: string; kpi: ParsedPosition['kpis'][number] }[];
  kpiInserts: ParsedPosition['kpis'];
  kpiDeletes: string[];
}

const same = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null);

const SIMPLE_MAP: { column: ColumnKey; field: keyof ParsedPosition; col: keyof ExistingPosition }[] = [
  { column: 'reportsTo', field: 'reportsTo', col: 'reports_to_text' },
  { column: 'supervises', field: 'supervisesText', col: 'supervises_text' },
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
    period: string,
  ): Promise<ImportResult> {
    assertPeriod(period);
    const sheets = await this.readWorkbook(file);
    // La división es una lista cerrada (`catalogs.divisions`): se guarda el nombre canónico y no se crea ninguna.
    const catalog = await loadCatalogDivisions(this.dataSource);
    const canonical = canonicalDivision(catalog, division);
    if (!canonical) throw divisionNotInCatalog(division.trim(), catalog);
    const levelCodes = await this.levelCodes(this.dataSource);
    const parsed = parseMatrixSheets(sheets, { levelCodes });
    if (parsed.dataRows > MAX_IMPORT_ROWS) throw new BadRequestException(`El archivo pasa del límite de ${MAX_IMPORT_ROWS} filas.`);
    const fileName = file?.originalname ?? '';
    const div = canonical;

    if (parsed.errors.length > 0) return this.result(mode, false, fileName, div, period, parsed, [], new Map(), []);

    // Lectura sin escribir: sirve de vista previa y de comprobación antes de aplicar (el peso del semestre puede no alcanzar).
    const pre = await this.resolveAreas(this.dataSource, parsed, div, false);
    const previewPlans = await this.plan(this.dataSource, pre.parsed, div, actor, period);
    const preRel = await this.planRelations(this.dataSource, pre.parsed, previewPlans, div);
    const blocking = [...this.weightErrors(pre.parsed, previewPlans), ...preRel.errors];
    if (mode === 'preview' || blocking.length > 0) {
      const withWarnings = this.withMissingWarnings({ ...pre.parsed, warnings: [...pre.parsed.warnings, ...preRel.warnings] }, previewPlans);
      const withErrors = { ...withWarnings, errors: [...withWarnings.errors, ...blocking] };
      return this.result(mode, false, fileName, div, period, withErrors, withErrors.positions, previewPlans, pre.created);
    }

    const { plans, areas } = await this.dataSource.transaction(async (m) => {
      // Mismo candado que el alta de puestos: dos importaciones (o un alta) simultáneas no repiten códigos.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('hr.job_positions.code'))`);
      // Las áreas nuevas se crean en la misma transacción: si algo falla, tampoco queda el área.
      const areas = await this.resolveAreas(m, parsed, div, true);
      const plans = await this.plan(m, areas.parsed, div, actor, period);
      // Si entre la vista previa y la escritura cambió el peso del semestre, no se escribe nada.
      const lateRel = await this.planRelations(m, areas.parsed, plans, div);
      const late = [...this.weightErrors(areas.parsed, plans), ...lateRel.errors];
      if (late.length > 0) throw new BadRequestException(late.map((e) => `Fila ${e.row}: ${e.message}`).join(' '));
      areas.parsed = { ...areas.parsed, warnings: [...areas.parsed.warnings, ...lateRel.warnings] };
      const ids = new Map<number, string>();
      const codes = ((await m.query(`SELECT code FROM hr.job_positions`)) as { code: string }[]).map((c) => c.code);
      for (const p of areas.parsed.positions) {
        const plan = plans.get(p.row)!;
        if (plan.action === 'sin cambios') continue;
        const code = plan.action === 'crear' ? nextPositionCode(codes) : plan.existing!.code;
        if (plan.action === 'crear') codes.push(code);
        ids.set(p.row, await this.write(m, p, plan, div, code, areas.parsed.columns, actor, period));
      }
      // Segunda pasada: con todos los puestos ya creados o actualizados se enlazan «Reporta a» y «Supervisa a».
      for (const p of areas.parsed.positions) {
        const plan = plans.get(p.row)!;
        if (plan.action === 'sin cambios' && !ids.has(p.row)) ids.set(p.row, plan.existing!.id);
      }
      await this.writeRelations(m, areas.parsed, plans, ids);
      return { plans, areas };
    });
    const applied = this.withMissingWarnings(areas.parsed, plans);
    const result = this.result(mode, true, fileName, div, period, applied, applied.positions, plans, areas.created);
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
        period: { from: null, to: period },
        created: { from: null, to: result.summary.created },
        updated: { from: null, to: result.summary.updated },
        unchanged: { from: null, to: result.summary.unchanged },
        newAreas: { from: null, to: result.summary.newAreas },
      },
    });
    return result;
  }

  /**
   * Lo que la pantalla necesita antes de analizar: la división deducida del título de la hoja, su coincidencia con
   * el catálogo (nombre canónico, sin distinguir mayúsculas, acentos ni espacios) y las divisiones válidas.
   */
  async inspect(file: { buffer: Buffer; originalname: string; size: number } | undefined): Promise<{
    sheet: string | null;
    divisionHint: string | null;
    division: string | null;
    divisions: string[];
  }> {
    const sheets = await this.readWorkbook(file);
    const parsed = parseMatrixSheets(sheets);
    const divisions = await loadCatalogDivisions(this.dataSource);
    const hint = parsed.divisionHint ?? deduceDivision(null);
    return { sheet: parsed.sheetName, divisionHint: hint, division: canonicalDivision(divisions, hint), divisions };
  }

  /** Un aviso por fila con los campos obligatorios del formulario que quedarían vacíos (nunca bloquea). */
  private withMissingWarnings(parsed: ParseResult, plans: Map<number, Plan>): ParseResult {
    const warnings = [...parsed.warnings];
    for (const p of parsed.positions) {
      const missing = plans.get(p.row)?.missing ?? [];
      if (missing.length > 0) warnings.push({ row: p.row, message: `Faltan campos obligatorios: ${missing.join(', ')}; complétalos en la pantalla del puesto` });
    }
    return { ...parsed, warnings };
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

  private relationsPreview(p: ParsedPosition, rel: RowRelations | null): ImportPositionPreview['relations'] {
    if (!rel || (rel.reportsTo === undefined && rel.supervises === undefined)) return null;
    return {
      reportsTo: rel.reportsTo?.title ?? null,
      reportsToText: p.reportsTo,
      supervises: rel.supervises?.titles ?? [],
      supervisesUnresolved: rel.supervises?.unresolved ?? [],
    };
  }

  /**
   * Resuelve «Reporta a» y «Supervisa a» de TODOS los puestos del archivo contra los del propio archivo y los vivos de la
   * misma división (por título normalizado). Un puesto cuya relación cambia pasa de «sin cambios» a «actualizar».
   */
  private async planRelations(m: Q, parsed: ParseResult, plans: Map<number, Plan>, division: string): Promise<{ errors: ImportIssue[]; warnings: ImportIssue[] }> {
    const hasReports = parsed.columns.has('reportsTo');
    const hasSupervises = parsed.columns.has('supervises');
    if (!hasReports && !hasSupervises) return { errors: [], warnings: [] };
    const live = (await m.query(`SELECT id, title, area, division, reports_to_position_id FROM hr.job_positions WHERE deleted_at IS NULL`)) as { id: string; title: string; area: string; division: string | null; reports_to_position_id: string | null }[];
    const links = (await m.query(
      `SELECT s.supervisor_position_id, s.supervised_position_id FROM hr.job_position_supervisions s
       JOIN hr.job_positions a ON a.id = s.supervisor_position_id AND a.deleted_at IS NULL
       JOIN hr.job_positions b ON b.id = s.supervised_position_id AND b.deleted_at IS NULL`,
    )) as { supervisor_position_id: string; supervised_position_id: string }[];
    const inFile = new Set<string>();
    const fileRows: RelFileRow[] = parsed.positions.map((p) => {
      const existing = plans.get(p.row)?.existing ?? null;
      if (existing) inFile.add(existing.id);
      return {
        row: p.row,
        title: p.title,
        area: p.area,
        existingId: existing?.id ?? null,
        hasReportsTo: hasReports,
        hasSupervises,
        reportsTo: p.reportsTo,
        supervises: p.supervises,
        currentReportsTo: existing?.reports_to_position_id ?? null,
        currentSupervises: existing ? links.filter((l) => l.supervisor_position_id === existing.id).map((l) => l.supervised_position_id) : [],
      };
    });
    const others = live
      .filter((e) => !inFile.has(e.id) && norm(e.division ?? '') === norm(division))
      .map((e) => ({ ref: e.id, title: e.title, area: e.area, reportsTo: e.reports_to_position_id }));
    const res = resolveImportRelations(fileRows, others);
    for (const p of parsed.positions) {
      const plan = plans.get(p.row)!;
      const rel = res.rows.get(p.row)!;
      plan.relations = rel;
      if (plan.action === 'sin cambios' && rel.changed) plan.action = 'actualizar';
    }
    return { errors: res.errors, warnings: res.warnings };
  }

  /** Escribe las relaciones ya resueltas (después de crear/actualizar todos los puestos del archivo): reemplaza las del puesto. */
  private async writeRelations(m: Q, parsed: ParseResult, plans: Map<number, Plan>, ids: Map<number, string>): Promise<void> {
    const idOf = (ref: string): string | null => (ref.startsWith('row:') ? (ids.get(Number(ref.slice(4))) ?? null) : ref);
    for (const p of parsed.positions) {
      const plan = plans.get(p.row)!;
      const rel = plan.relations;
      const id = ids.get(p.row);
      if (!rel || !id || !rel.changed) continue;
      if (rel.reportsTo !== undefined) {
        const target = rel.reportsTo.ref ? idOf(rel.reportsTo.ref) : null;
        await m.query(`UPDATE hr.job_positions SET reports_to_position_id = $2, updated_at = NOW() WHERE id = $1`, [id, target]);
      }
      if (rel.supervises !== undefined) {
        const wanted = rel.supervises.refs.map(idOf).filter((x): x is string => x !== null);
        await m.query(`DELETE FROM hr.job_position_supervisions WHERE supervisor_position_id = $1 AND NOT (supervised_position_id = ANY($2::uuid[]))`, [id, wanted]);
        if (wanted.length > 0) {
          await m.query(
            `INSERT INTO hr.job_position_supervisions (supervisor_position_id, supervised_position_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
            [id, wanted],
          );
        }
      }
    }
  }

  /** Un error por puesto cuyo semestre no tiene peso para darle al menos 1 a cada OKR nuevo. */
  private weightErrors(parsed: ParseResult, plans: Map<number, Plan>): ImportIssue[] {
    const out: ImportIssue[] = [];
    for (const p of parsed.positions) {
      const plan = plans.get(p.row);
      if (plan?.weightError) out.push({ row: p.row, message: `${plan.weightError} (puesto «${p.title}»)` });
    }
    return out;
  }

  private async plan(m: Q, parsed: ParseResult, division: string, actor: Actor, period: string): Promise<Map<number, Plan>> {
    const existingAll = (await m.query(`SELECT * FROM hr.job_positions WHERE deleted_at IS NULL`)) as ExistingPosition[];
    const byIdentity = new Map(existingAll.map((e) => [identity(e.division ?? '', e.area, e.title), e]));
    const plans = new Map<number, Plan>();
    for (const p of parsed.positions) {
      const existing = byIdentity.get(identity(division, p.area, p.title)) ?? null;
      plans.set(p.row, existing ? await this.planUpdate(m, p, existing, parsed.columns, actor, period) : this.planCreate(p, actor, period));
    }
    return plans;
  }

  private planCreate(p: ParsedPosition, actor: Actor, period: string): Plan {
    // Puesto nuevo: toda la capacidad del semestre (100) se reparte entre sus OKRs.
    const spread = this.spreadWeights([], p.okrs, period);
    const validation = applyValidationChange({ status: 'pendiente', by: null, at: null }, p.validationStatus, actor.id ?? null, new Date());
    return {
      action: 'crear',
      missing: missingRequiredFields({ roleSummary: p.roleSummary, positionObjective: p.positionObjective, validationPoints: p.validationPoints, description: null }).map((f) => f.label),
      existing: null,
      simple: {},
      validation,
      headComments: p.headComments ? { value: p.headComments } : null,
      replaceActivities: p.activities.length > 0,
      okrUpdates: [],
      okrInserts: spread.inserts,
      okrDeletes: [],
      okrView: spread.view,
      weightError: spread.error,
      relations: null,
      kpiUpdates: [],
      kpiInserts: p.kpis,
      kpiDeletes: [],
    };
  }

  /**
   * Reparto equitativo con enteros del peso que queda en el semestre entre los OKRs nuevos: capacidad = 100 menos la suma
   * de los pesos de los OKRs activos que se conservan; base = floor(capacidad / n) y los primeros `resto` (por orden)
   * reciben una unidad más (100 entre 3 → 34/33/33). Los OKRs que ya existen nunca cambian de peso.
   */
  private spreadWeights(kept: ExistingOkr[], news: ParsedPosition['okrs'], period: string): { inserts: NewOkr[]; view: ImportOkrPreview[]; error: string | null } {
    const used = kept.filter((o) => o.is_active).reduce((sum, o) => sum + Number(o.weight), 0);
    const capacity = MAX_WEIGHT_SUM - used;
    const weights = splitWeights(capacity, news.length);
    const view: ImportOkrPreview[] = kept.map((o) => ({ objectiveCode: o.objective_code ?? '', krCode: o.kr_code ?? '', weight: Number(o.weight), isNew: false }));
    if (weights === null) return { inserts: [], view, error: `No hay peso disponible en el semestre ${period}` };
    const inserts = news.map((o, i) => ({ ...o, weight: weights[i]! }));
    for (const o of inserts) view.push({ objectiveCode: o.objectiveCode, krCode: o.krCode, weight: o.weight, isNew: true });
    return { inserts, view, error: null };
  }

  private async planUpdate(m: Q, p: ParsedPosition, e: ExistingPosition, columns: ReadonlySet<ColumnKey>, actor: Actor, period: string): Promise<Plan> {
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
    // Categoría: solo si la columna de jerarquía del archivo trae una; si no, se conserva la del sistema.
    if (columns.has('hierarchy') && p.seniority !== null && p.seniority !== e.seniority) simple.seniority = p.seniority;

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
    let okrInserts: Plan['okrInserts'] = [];
    const okrDeletes: string[] = [];
    let okrView: ImportOkrPreview[] = [];
    let weightError: string | null = null;
    if (columns.has('okrs')) {
      // Solo el semestre elegido: los OKRs de otros semestres no se tocan.
      const cur = (await m.query(
        `SELECT id, objective_code, kr_code, objective, key_result, sort_order, weight, is_active FROM hr.job_position_okrs
         WHERE job_position_id = $1 AND period = $2 AND deleted_at IS NULL ORDER BY sort_order, created_at`,
        [e.id, period],
      )) as ExistingOkr[];
      const byKey = new Map(cur.filter((o) => o.objective_code && o.kr_code).map((o) => [`${o.objective_code}|${o.kr_code}`, o]));
      const used = new Set<string>();
      const news: ParsedPosition['okrs'] = [];
      for (const okr of p.okrs) {
        const match = byKey.get(`${okr.objectiveCode}|${okr.krCode}`);
        if (match && !used.has(match.id)) {
          used.add(match.id);
          // Solo texto y orden: el peso de un OKR que ya existe nunca cambia con la importación.
          if (match.objective !== okr.objective || match.key_result !== okr.keyResult || match.sort_order !== okr.sortOrder) okrUpdates.push({ id: match.id, okr });
        } else news.push(okr);
      }
      for (const o of cur) if (!used.has(o.id)) okrDeletes.push(o.id);
      const spread = this.spreadWeights(cur.filter((o) => used.has(o.id)), news, period);
      okrInserts = spread.inserts;
      okrView = spread.view;
      weightError = spread.error;
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
    // Tras importar, cada campo vale lo del archivo si la columna viene y, si no, lo que ya tenía el puesto.
    const after = (column: ColumnKey, fileValue: string | null, current: string | null): string | null => (columns.has(column) ? fileValue : current);
    return {
      action: changed ? 'actualizar' : 'sin cambios',
      missing: missingRequiredFields({
        roleSummary: after('role', p.roleSummary, e.role_summary),
        positionObjective: after('objective', p.positionObjective, e.position_objective),
        validationPoints: after('validationPoints', p.validationPoints, e.validation_points),
        description: e.description,
      }).map((f) => f.label),
      existing: e,
      simple,
      validation,
      headComments,
      replaceActivities,
      okrUpdates,
      okrInserts,
      okrDeletes,
      okrView,
      weightError,
      relations: null,
      kpiUpdates,
      kpiInserts,
      kpiDeletes,
    };
  }

  // ── Escritura (dentro de la transacción de `apply`) ────────────────────────

  private async write(m: Q, p: ParsedPosition, plan: Plan, division: string, code: string, columns: ReadonlySet<ColumnKey>, actor: Actor, period: string): Promise<string> {
    let positionId: string;
    if (plan.action === 'crear') {
      // `description` queda vacía y `status` activo: la descripción formal se redacta y aprueba aparte.
      const rows = (await m.query(
        `INSERT INTO hr.job_positions (code, title, area, level, status, created_by, division, reports_to_text,
           plazas, role_summary, position_objective, validation_points, head_comments,
           validation_status, validated_by, validated_at, level_original, seniority, supervises_text)
         VALUES ($1,$2,$3,$4,'activo',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
        [
          // `reports_to_employee_id` NO se escribe: «Reporta a» como empleado se elige en la pantalla del puesto.
          code, p.title, p.area, p.level, actor.id ?? null, division, p.reportsTo, p.plazas,
          p.roleSummary, p.positionObjective, p.validationPoints, plan.headComments?.value ?? null,
          plan.validation?.status ?? 'pendiente', plan.validation?.by ?? null, plan.validation?.at ?? null,
          p.levelOriginal, p.seniority, p.supervisesText,
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
      // Semestre elegido y peso entero del reparto equitativo (se puede ajustar después en la pantalla del puesto).
      await m.query(
        `INSERT INTO hr.job_position_okrs (job_position_id, period, objective_code, kr_code, objective, key_result, weight, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [positionId, period, o.objectiveCode, o.krCode, o.objective, o.keyResult, o.weight, o.sortOrder],
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
    return positionId;
  }

  // ── Respuesta ──────────────────────────────────────────────────────────────

  private result(
    mode: 'preview' | 'apply',
    applied: boolean,
    fileName: string,
    division: string,
    period: string,
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
      okrs: plans.get(p.row)?.okrView ?? [],
      relations: this.relationsPreview(p, plans.get(p.row)?.relations ?? null),
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
      period,
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
