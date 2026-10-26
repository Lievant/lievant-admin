import { BadRequestException } from '@nestjs/common';

export const POSITION_STATUSES = ['activo', 'inactivo', 'pendiente_aprobacion'] as const;
/** Lo que RRHH puede fijar a mano; `pendiente_aprobacion` lo pone el sistema. */
export const MANUAL_STATUSES = ['activo', 'inactivo'] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const MEASUREMENT_FREQUENCIES = ['mensual', 'trimestral', 'semestral', 'anual'] as const;
export const PERIOD_REGEX = /^[0-9]{4}-S[12]$/;

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 10000;
export const MAX_OKR_TEXT = 2000;
export const MAX_WEIGHT_SUM = 100;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const POSITION_NOT_FOUND = 'Puesto no encontrado';
export const OKR_NOT_FOUND = 'OKR no encontrado';
export const KPI_NOT_FOUND = 'KPI no encontrado';

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
  level?: string | undefined;
  status?: PositionStatus | undefined;
  search?: string | undefined;
}

/** Escapa % _ \ para usar el texto como literal dentro de un ILIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
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
  if (f.level) {
    params.push(f.level);
    clauses.push(`p.level = $${params.length}`);
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
  };
}

export interface OkrRow {
  id: string;
  job_position_id: string;
  period: string;
  objective: string;
  key_result: string;
  weight: string | number | null;
  sort_order: number;
  is_active: boolean;
}

export interface OkrView {
  id: string;
  jobPositionId: string;
  period: string;
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

export interface PositionDetail extends PositionListItem {
  description: string | null;
  approvedBy: { id: string; name: string | null } | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  okrs: OkrView[];
  kpis: KpiView[];
}

export function toDetail(r: PositionRow, okrs: OkrView[], kpis: KpiView[]): PositionDetail {
  return {
    ...toListItem(r),
    description: r.description,
    approvedBy: r.description_approved_by ? { id: r.description_approved_by, name: r.approver_name ?? null } : null,
    approvedAt: r.description_approved_at ? new Date(r.description_approved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    okrs,
    kpis,
  };
}
