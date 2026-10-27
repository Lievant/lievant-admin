import { BadRequestException } from '@nestjs/common';

export const PERIOD_REGEX = /^[0-9]{4}-S[12]$/;
export const EMPLOYEE_NOT_FOUND = 'Colaborador no encontrado';
export const POSITION_NOT_FOUND = 'Puesto no encontrado';
export const OKR_NOT_FOUND = 'OKR no encontrado';
export const KPI_NOT_FOUND = 'KPI no encontrado';
export const NO_POSITION_MESSAGE = 'El colaborador no tiene un puesto vinculado';
export const DESCRIPTION_PENDING = 'Descripción de puesto pendiente';
export const NO_POSITION_LABEL = 'Sin puesto asignado';

// ── Periodo (America/Mexico_City) ────────────────────────────────────────────

/** Periodo del semestre actual en la oficina: enero–junio = S1, julio–diciembre = S2. */
export function currentPeriodMx(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
  return `${year}-S${month <= 6 ? 1 : 2}`;
}

export function assertPeriod(period: string): void {
  if (!PERIOD_REGEX.test(period)) throw new BadRequestException('El periodo debe tener formato AAAA-S1 o AAAA-S2');
}

// ── Descripción y sugerencia ─────────────────────────────────────────────────

/** Solo se muestra la descripción aprobada y no vacía; en otro caso, null (pendiente). */
export function visibleDescription(description: string | null, approved: boolean): string | null {
  if (!approved) return null;
  const t = (description ?? '').trim();
  return t === '' ? null : t;
}

/** Minúsculas, sin acentos y con espacios colapsados, para comparar cargo contra título. */
export function normalizeText(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Sugerencia solo si el cargo coincide con el título de EXACTAMENTE un puesto; nunca vincula sola. */
export function findSuggestion<T extends { title: string }>(position: string | null | undefined, candidates: T[]): T | null {
  const wanted = normalizeText(position);
  if (wanted === '') return null;
  const matches = candidates.filter((c) => normalizeText(c.title) === wanted);
  return matches.length === 1 ? (matches[0] as T) : null;
}

// ── Regla de acceso por empleado ─────────────────────────────────────────────

export interface AccessFacts {
  /** Tiene `rrhh.desarrollo-organizacional.read`. */
  hasReadPermission: boolean;
  /** El empleado consultado es el del usuario. */
  isSelf: boolean;
  /** El empleado consultado reporta DIRECTAMENTE al empleado del usuario (no transitivo). */
  isDirectLeader: boolean;
}

/** Con permiso, el propio colaborador o su líder directo; cualquier otro caso es 404. */
export function canViewEmployeeDevelopment(f: AccessFacts): boolean {
  return f.hasReadPermission || f.isSelf || f.isDirectLeader;
}

// ── Vistas ───────────────────────────────────────────────────────────────────

export interface PositionSummary {
  id: string;
  code: string;
  title: string;
  area: string;
  level: string | null;
}

export interface OkrView {
  id: string;
  objective: string;
  keyResult: string;
  weight: number | null;
}

export interface KpiView {
  id: string;
  name: string;
  description: string | null;
  targetValue: string | null;
  measurementFrequency: string | null;
}

export interface DevelopmentView {
  employeeId: string;
  position: PositionSummary | null;
  description: string | null;
  descriptionPending: boolean;
  suggestedPosition: PositionSummary | null;
  period: string;
  periodsWithData: string[];
  okrs: OkrView[];
  weightSum: number;
  kpis: KpiView[];
}

export const toPositionSummary = (r: { id: string; code: string; title: string; area: string; level: string | null }): PositionSummary => ({
  id: r.id,
  code: r.code,
  title: r.title,
  area: r.area,
  level: r.level,
});

export const toOkrView = (r: { id: string; objective: string; key_result: string; weight: string | number | null }): OkrView => ({
  id: r.id,
  objective: r.objective,
  keyResult: r.key_result,
  weight: r.weight === null ? null : Number(r.weight),
});

export const toKpiView = (r: { id: string; name: string; description: string | null; target_value: string | null; measurement_frequency: string | null }): KpiView => ({
  id: r.id,
  name: r.name,
  description: r.description,
  targetValue: r.target_value,
  measurementFrequency: r.measurement_frequency,
});

/** Suma de pesos en centésimas, sin errores de coma flotante. */
export const sumWeights = (okrs: { weight: number | null }[]): number =>
  okrs.reduce((acc, o) => acc + Math.round((o.weight ?? 0) * 100), 0) / 100;

export interface AssignmentSummary {
  okrsCopied: number;
  okrsSkipped: number;
  kpisCopied: number;
  kpisSkipped: number;
}

export interface BulkAssignmentSummary extends AssignmentSummary {
  employees: number;
}

/** Copiados + omitidos = lo que había en el puesto. */
export function summarize(okrTotal: number, okrCopied: number, kpiTotal: number, kpiCopied: number): AssignmentSummary {
  return { okrsCopied: okrCopied, okrsSkipped: okrTotal - okrCopied, kpisCopied: kpiCopied, kpisSkipped: kpiTotal - kpiCopied };
}

export function addSummaries(a: BulkAssignmentSummary, b: AssignmentSummary): BulkAssignmentSummary {
  return {
    employees: a.employees + 1,
    okrsCopied: a.okrsCopied + b.okrsCopied,
    okrsSkipped: a.okrsSkipped + b.okrsSkipped,
    kpisCopied: a.kpisCopied + b.kpisCopied,
    kpisSkipped: a.kpisSkipped + b.kpisSkipped,
  };
}
