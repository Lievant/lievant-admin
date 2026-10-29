import { BadRequestException } from '@nestjs/common';

export const POSITION_STATUSES = ['activo', 'inactivo', 'pendiente_aprobacion'] as const;
/** Lo que RRHH puede fijar a mano; `pendiente_aprobacion` lo pone el sistema. */
export const MANUAL_STATUSES = ['activo', 'inactivo'] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const MEASUREMENT_FREQUENCIES = ['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual'] as const;
/** Frecuencias de las actividades: las de los KPIs más "eventual". */
export const ACTIVITY_FREQUENCIES = ['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual', 'eventual'] as const;
export type ActivityFrequency = (typeof ACTIVITY_FREQUENCIES)[number];

export const VALIDATION_STATUSES = ['pendiente', 'validado', 'validado_con_ajustes', 'rechazado'] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];
/** Valor del parámetro de periodo que designa la plantilla (OKRs sin periodo). */
export const BASE_PERIOD = 'base';
export const PERIOD_REGEX = /^[0-9]{4}-S[12]$/;

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 10000;
export const MAX_OKR_TEXT = 2000;
export const MAX_WEIGHT_SUM = 100;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

/** Campos obligatorios al guardar el formulario del puesto (crear y editar) y su mensaje en español. */
export const REQUIRED_POSITION_FIELDS = [
  { key: 'roleSummary', label: 'Rol', message: 'El rol es obligatorio' },
  { key: 'positionObjective', label: 'Objetivo del puesto', message: 'El objetivo del puesto es obligatorio' },
  { key: 'validationPoints', label: 'Puntos a validar', message: 'Los puntos a validar son obligatorios' },
  { key: 'description', label: 'Descripción del puesto', message: 'La descripción del puesto es obligatoria' },
] as const;
export type RequiredPositionKey = (typeof REQUIRED_POSITION_FIELDS)[number]['key'];

/** Campos obligatorios que están vacíos (solo espacios cuenta como vacío). */
export function missingRequiredFields(values: Partial<Record<RequiredPositionKey, string | null | undefined>>): (typeof REQUIRED_POSITION_FIELDS)[number][] {
  return REQUIRED_POSITION_FIELDS.filter((f) => (values[f.key] ?? '').toString().trim() === '');
}

export const POSITION_NOT_FOUND = 'Puesto no encontrado';
export const OKR_NOT_FOUND = 'OKR no encontrado';
export const KPI_NOT_FOUND = 'KPI no encontrado';
export const ACTIVITY_NOT_FOUND = 'Actividad no encontrada';

// ── Código consecutivo ───────────────────────────────────────────────────────

const CODE_REGEX = /^JP-([0-9]+)$/;

/** 'JP-001', 'JP-099', 'JP-1000': relleno a 3 dígitos y más si crece. */
export function formatPositionCode(n: number): string {
  return `JP-${String(n).padStart(3, '0')}`;
}

/**
 * Siguiente código a partir de TODOS los códigos existentes, incluidos los de
 * puestos eliminados: así un código eliminado nunca se reutiliza.
 */
export function nextPositionCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const m = CODE_REGEX.exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return formatPositionCode(max + 1);
}

// ── Descripción y estado ─────────────────────────────────────────────────────

/** Texto normalizado: recortado, o null si queda vacío. */
export function normalizeDescription(value: string | null | undefined): string | null {
  const t = (value ?? '').trim();
  return t === '' ? null : t;
}

export interface DescriptionState {
  description: string | null;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
}

/**
 * Efecto de cambiar el TEXTO de la descripción sobre la aprobación: si el texto
 * cambia (o queda vacío) la aprobación se invalida; si no cambia, se conserva.
 */
export function applyDescriptionChange(current: DescriptionState, next: string | null | undefined): DescriptionState {
  if (next === undefined) return current;
  const text = normalizeDescription(next);
  if (text === current.description) return current;
  return { description: text, approved: false, approvedBy: null, approvedAt: null };
}

/**
 * Estado final: `inactivo` lo decide RRHH y se respeta; en cualquier otro caso un
 * puesto con descripción sin aprobar queda `pendiente_aprobacion` y, sin
 * descripción o con ella aprobada, `activo`.
 */
export function resolveStatus(requested: PositionStatus, d: Pick<DescriptionState, 'description' | 'approved'>): PositionStatus {
  if (requested === 'inactivo') return 'inactivo';
  return d.description !== null && !d.approved ? 'pendiente_aprobacion' : 'activo';
}

/** Validación para aprobar: requiere descripción no vacía y que no esté ya aprobada. */
export function assertCanApprove(d: Pick<DescriptionState, 'description' | 'approved'>): void {
  if (d.description === null) throw new BadRequestException('El puesto no tiene descripción para aprobar');
  if (d.approved) throw new BadRequestException('La descripción ya está aprobada');
}

/** Estado tras aprobar: `pendiente_aprobacion` pasa a `activo`; `inactivo` se queda. */
export function statusAfterApproval(status: PositionStatus): PositionStatus {
  return status === 'pendiente_aprobacion' ? 'activo' : status;
}

// ── OKRs: periodo y pesos ────────────────────────────────────────────────────

export function assertPeriod(period: string): void {
  if (!PERIOD_REGEX.test(period)) {
    throw new BadRequestException('El periodo debe tener formato AAAA-S1 o AAAA-S2');
  }
}

/**
 * Periodo de un OKR de la Matriz: vacío/null/'base' = plantilla (NULL en la base); en otro caso AAAA-S1/S2.
 * `undefined` se conserva (no se pidió cambiar).
 */
export function normalizeOkrPeriod(period: string | null | undefined): string | null | undefined {
  if (period === undefined) return undefined;
  const p = (period ?? '').trim();
  if (p === '' || p === BASE_PERIOD) return null;
  assertPeriod(p);
  return p;
}

export function assertFrequency(freq: string | null | undefined): void {
  if (freq === null || freq === undefined) return;
  if (!(MEASUREMENT_FREQUENCIES as readonly string[]).includes(freq)) {
    throw new BadRequestException('La frecuencia de medición no es válida');
  }
}

/** Suma de pesos (en centésimas, para no arrastrar errores de coma flotante). */
export function sumWeights(weights: (number | null)[]): number {
  return weights.reduce<number>((acc, w) => acc + Math.round((w ?? 0) * 100), 0) / 100;
}

/**
 * La suma de pesos de los OKRs ACTIVOS de un puesto en un periodo no puede pasar
 * de 100. `others` son los demás OKRs vivos del periodo (sin el que se guarda);
 * justo 100 es válido y los eliminados no cuentan (ni llegan aquí).
 */
export function assertWeightSum(others: (number | null)[], own: number | null, ownActive: boolean): void {
  if (!ownActive || own === null) return;
  const total = sumWeights([...others, own]);
  if (total > MAX_WEIGHT_SUM) {
    throw new BadRequestException(
      `La suma de pesos del periodo no puede pasar de ${MAX_WEIGHT_SUM} % (con este peso quedaría en ${total} %)`,
    );
  }
}

// ── Listado ──────────────────────────────────────────────────────────────────

export interface PositionFilters {
  area?: string | undefined;
  businessUnit?: string | undefined;
  division?: string | undefined;
  level?: string | undefined;
  seniority?: string | undefined;
  status?: PositionStatus | undefined;
  validationStatus?: ValidationStatus | undefined;
  search?: string | undefined;
}

/** Escapa % _ \ para usar el texto como literal dentro de un ILIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ── Orden de la lista (en el servidor, sobre todos los registros) ────────────

/** Columnas por las que se puede ordenar la lista: lista cerrada (nunca se interpola texto del usuario en el SQL). */
export const POSITION_SORT_COLUMNS = ['code', 'title', 'division', 'area', 'level', 'seniority', 'plazas', 'validationStatus', 'status'] as const;
export type PositionSortColumn = (typeof POSITION_SORT_COLUMNS)[number];
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

/** Texto sin mayúsculas, acentos ni espacios sobrantes; vacío = NULL (así va siempre al final). */
const fold = (col: string): string => `NULLIF(translate(lower(btrim(${col})), 'áéíóúüñ', 'aeiouun'), '')`;

/** Desempate estable (y orden por defecto): código numérico, para que la paginación no repita ni salte filas. */
const CODE_ORDER = 'length(p.code) ASC, p.code ASC';

const SORT_EXPRESSIONS: Record<PositionSortColumn, string> = {
  // «JP-2» antes que «JP-10»: por el número del código, no alfabético.
  code: `NULLIF(regexp_replace(p.code, '\\D', '', 'g'), '')::bigint`,
  title: fold('p.title'),
  division: fold('p.division'),
  area: fold('p.area'),
  // Por el orden del catálogo (sort_order de I a IX); un nivel fuera del catálogo cuenta como vacío.
  level: `(SELECT l.sort_order FROM catalogs.org_levels l WHERE upper(btrim(l.code)) = upper(btrim(p.level)) LIMIT 1)`,
  seniority: `CASE p.seniority WHEN 'junior' THEN 1 WHEN 'semi_senior' THEN 2 WHEN 'senior' THEN 3 END`,
  plazas: 'p.plazas',
  // Mismo orden lógico que ya usan los filtros de la pantalla.
  validationStatus: `CASE p.validation_status WHEN 'pendiente' THEN 1 WHEN 'validado' THEN 2 WHEN 'validado_con_ajustes' THEN 3 WHEN 'rechazado' THEN 4 END`,
  status: `CASE p.status WHEN 'activo' THEN 1 WHEN 'pendiente_aprobacion' THEN 2 WHEN 'inactivo' THEN 3 END`,
};

/**
 * `ORDER BY` de la lista. Sin `sortBy` es el de siempre (código numérico). Los vacíos van siempre al final, en
 * ascendente y en descendente, y el código desempata. Una columna fuera de la lista da 400.
 */
export function buildPositionOrder(sortBy?: string, sortDir?: string): string {
  if (sortBy === undefined || sortBy === '') return CODE_ORDER;
  const expression = (SORT_EXPRESSIONS as Record<string, string | undefined>)[sortBy];
  if (!expression) throw new BadRequestException('La columna de orden no es válida');
  const direction = sortDir === 'desc' ? 'DESC' : 'ASC';
  return `${expression} ${direction} NULLS LAST, ${CODE_ORDER}`;
}

export function buildPositionWhere(f: PositionFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses = ['p.deleted_at IS NULL'];
  if (f.area) {
    params.push(f.area);
    clauses.push(`p.area = $${params.length}`);
  }
  if (f.businessUnit) {
    params.push(f.businessUnit);
    clauses.push(`p.business_unit = $${params.length}`);
  }
  if (f.division) {
    params.push(f.division);
    // Sin distinguir mayúsculas, acentos ni espacios: «TI» y «ti » son la misma división (también las antiguas fuera de catálogo).
    clauses.push(`translate(lower(btrim(p.division)), 'áéíóúüñ', 'aeiouun') = translate(lower(btrim($${params.length})), 'áéíóúüñ', 'aeiouun')`);
  }
  if (f.level) {
    params.push(f.level);
    clauses.push(`p.level = $${params.length}`);
  }
  if (f.seniority) {
    params.push(f.seniority);
    clauses.push(`p.seniority = $${params.length}`);
  }
  if (f.validationStatus) {
    params.push(f.validationStatus);
    clauses.push(`p.validation_status = $${params.length}`);
  }
  if (f.status) {
    params.push(f.status);
    clauses.push(`p.status = $${params.length}`);
  }
  const search = f.search?.trim();
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    clauses.push(`(p.code ILIKE $${params.length} OR p.title ILIKE $${params.length})`);
  }
  return { where: clauses.join(' AND '), params };
}

// ── Vistas ───────────────────────────────────────────────────────────────────

export interface PositionRow {
  id: string;
  code: string;
  title: string;
  area: string;
  business_unit: string | null;
  level: string | null;
  description: string | null;
  description_approved: boolean;
  description_approved_by: string | null;
  approver_name?: string | null;
  description_approved_at: Date | null;
  status: PositionStatus;
  division: string | null;
  level_original: string | null;
  seniority: string | null;
  reports_to_text: string | null;
  reports_to_employee_id: string | null;
  reports_to_name?: string | null;
  reports_to_position?: string | null;
  reports_to_active?: boolean | null;
  plazas: number | null;
  role_summary: string | null;
  position_objective: string | null;
  validation_points: string | null;
  head_comments: string | null;
  validation_status: ValidationStatus;
  validated_by: string | null;
  validator_name?: string | null;
  validated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  total_count?: string | number;
}

export interface PositionListItem {
  id: string;
  code: string;
  title: string;
  area: string;
  businessUnit: string | null;
  level: string | null;
  status: PositionStatus;
  hasDescription: boolean;
  descriptionApproved: boolean;
  division: string | null;
  seniority: string | null;
  plazas: number | null;
  /** `plazas = 0`: se muestra como "Vacante". */
  vacant: boolean;
  validationStatus: ValidationStatus;
}

export function toListItem(r: PositionRow): PositionListItem {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    area: r.area,
    businessUnit: r.business_unit,
    level: r.level,
    status: r.status,
    hasDescription: r.description !== null && r.description !== '',
    descriptionApproved: r.description_approved,
    division: r.division,
    seniority: r.seniority,
    plazas: r.plazas,
    vacant: r.plazas === 0,
    validationStatus: r.validation_status,
  };
}

export interface OkrRow {
  id: string;
  job_position_id: string;
  period: string | null;
  objective_code: string | null;
  kr_code: string | null;
  objective: string;
  key_result: string;
  weight: string | number | null;
  sort_order: number;
  is_active: boolean;
}

export interface OkrView {
  id: string;
  jobPositionId: string;
  /** null = plantilla (vale para cualquier semestre). */
  period: string | null;
  objectiveCode: string | null;
  krCode: string | null;
  objective: string;
  keyResult: string;
  weight: number | null;
  sortOrder: number;
  isActive: boolean;
}

export function toOkrView(r: OkrRow): OkrView {
  return {
    id: r.id,
    jobPositionId: r.job_position_id,
    period: r.period,
    objectiveCode: r.objective_code,
    krCode: r.kr_code,
    objective: r.objective,
    keyResult: r.key_result,
    weight: r.weight === null ? null : Number(r.weight),
    sortOrder: r.sort_order,
    isActive: r.is_active,
  };
}

export interface KpiRow {
  id: string;
  job_position_id: string;
  name: string;
  description: string | null;
  target_value: string | null;
  measurement_frequency: string | null;
  is_active: boolean;
}

export interface KpiView {
  id: string;
  jobPositionId: string;
  name: string;
  description: string | null;
  targetValue: string | null;
  measurementFrequency: string | null;
  isActive: boolean;
}

export function toKpiView(r: KpiRow): KpiView {
  return {
    id: r.id,
    jobPositionId: r.job_position_id,
    name: r.name,
    description: r.description,
    targetValue: r.target_value,
    measurementFrequency: r.measurement_frequency,
    isActive: r.is_active,
  };
}

export interface ActivityRow {
  id: string;
  job_position_id: string;
  group_order: number;
  group_title: string;
  sort_order: number;
  description: string;
  frequency: ActivityFrequency | null;
  note: string | null;
}

export interface ActivityView {
  id: string;
  jobPositionId: string;
  groupOrder: number;
  groupTitle: string;
  sortOrder: number;
  description: string;
  frequency: ActivityFrequency | null;
  note: string | null;
}

export function toActivityView(r: ActivityRow): ActivityView {
  return {
    id: r.id,
    jobPositionId: r.job_position_id,
    groupOrder: r.group_order,
    groupTitle: r.group_title,
    sortOrder: r.sort_order,
    description: r.description,
    frequency: r.frequency,
    note: r.note,
  };
}

export interface ValidationState {
  status: ValidationStatus;
  by: string | null;
  at: Date | null;
}

/**
 * Efecto de cambiar el estado de validación: cualquier valor distinto de `pendiente` guarda quién y cuándo
 * (de la sesión); volver a `pendiente` los limpia; si el estado no cambia se conservan.
 */
export function applyValidationChange(current: ValidationState, next: ValidationStatus | undefined, actorId: string | null, now: Date): ValidationState {
  if (next === undefined || next === current.status) return current;
  if (next === 'pendiente') return { status: 'pendiente', by: null, at: null };
  return { status: next, by: actorId, at: now };
}

export interface PositionDetail extends PositionListItem {
  /** Texto del nivel como venía en el Excel (solo lectura). */
  levelOriginal: string | null;
  /** Texto de «Reporta a» que venía del Excel (solo lectura en la pantalla). */
  reportsTo: string | null;
  /** «Reporta a» ligado a un empleado; `active: false` = ya no está activo («Baja»). */
  reportsToEmployee: { id: string; fullName: string; position: string | null; active: boolean } | null;
  roleSummary: string | null;
  positionObjective: string | null;
  validationPoints: string | null;
  headComments: string | null;
  validatedBy: { id: string; name: string | null } | null;
  validatedAt: string | null;
  description: string | null;
  approvedBy: { id: string; name: string | null } | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  okrs: OkrView[];
  kpis: KpiView[];
  activities: ActivityView[];
}

export function toDetail(r: PositionRow, okrs: OkrView[], kpis: KpiView[], activities: ActivityView[] = []): PositionDetail {
  return {
    ...toListItem(r),
    levelOriginal: r.level_original,
    reportsTo: r.reports_to_text,
    reportsToEmployee: r.reports_to_employee_id
      ? { id: r.reports_to_employee_id, fullName: r.reports_to_name ?? 'Empleado', position: r.reports_to_position ?? null, active: r.reports_to_active !== false }
      : null,
    roleSummary: r.role_summary,
    positionObjective: r.position_objective,
    validationPoints: r.validation_points,
    headComments: r.head_comments,
    validatedBy: r.validated_by ? { id: r.validated_by, name: r.validator_name ?? null } : null,
    validatedAt: r.validated_at ? new Date(r.validated_at).toISOString() : null,
    description: r.description,
    approvedBy: r.description_approved_by ? { id: r.description_approved_by, name: r.approver_name ?? null } : null,
    approvedAt: r.description_approved_at ? new Date(r.description_approved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    okrs,
    kpis,
    activities,
  };
}
