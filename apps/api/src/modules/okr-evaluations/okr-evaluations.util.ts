import { BadRequestException, ConflictException } from '@nestjs/common';
import { PERIOD_REGEX, currentPeriodMx } from '../employee-development/employee-development.util';

// ── Constantes ajustables (decisiones PROVISIONALES: Paulo las confirmará) ───

/**
 * ¿El colaborador ve su calificación en Mi Información? Apagada por defecto.
 * Encenderla es un cambio de una línea. Los comentarios del líder NUNCA se le
 * muestran al colaborador en este módulo, con la bandera que sea.
 */
export const OKR_SCORE_VISIBLE_TO_EMPLOYEE = false;

/** Cuántos periodos son evaluables: el semestre actual y el inmediato anterior. */
export const EVALUABLE_PERIODS_COUNT = 2;

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;
export const MAX_COMMENTS = 2000;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const EXPORT_MAX_ROWS = 20000;

export const NOT_FOUND = 'Colaborador no encontrado';
export const OKR_NOT_FOUND = 'OKR no encontrado';
export const READ_ONLY_PERIOD_MESSAGE = 'Este periodo es de solo lectura: solo se evalúan el semestre actual y el anterior';

// ── Periodos ─────────────────────────────────────────────────────────────────

/** Periodo anterior: AAAA-S2 → AAAA-S1; AAAA-S1 → (AAAA-1)-S2. */
export function previousPeriod(period: string): string {
  const m = /^([0-9]{4})-S([12])$/.exec(period);
  if (!m) throw new BadRequestException('El periodo debe tener formato AAAA-S1 o AAAA-S2');
  const year = Number(m[1]);
  return m[2] === '2' ? `${year}-S1` : `${year - 1}-S2`;
}

/** Periodos evaluables, el más reciente primero, en hora de México. */
export function evaluablePeriods(now: Date = new Date()): string[] {
  const periods = [currentPeriodMx(now)];
  while (periods.length < EVALUABLE_PERIODS_COUNT) periods.push(previousPeriod(periods[periods.length - 1] as string));
  return periods;
}

export const isEvaluablePeriod = (period: string, now: Date = new Date()): boolean => evaluablePeriods(now).includes(period);

/** Los periodos más antiguos o futuros son solo lectura: guardar da 409. */
export function assertEvaluablePeriod(period: string, now: Date = new Date()): void {
  if (!isEvaluablePeriod(period, now)) throw new ConflictException(READ_ONLY_PERIOD_MESSAGE);
}

export function assertValidPeriod(period: string): void {
  if (!PERIOD_REGEX.test(period)) throw new BadRequestException('El periodo debe tener formato AAAA-S1 o AAAA-S2');
}

// ── Calificación ─────────────────────────────────────────────────────────────

/** Número entre 0 y 100 (100 incluido) con hasta dos decimales. */
export function validateScore(score: unknown): number {
  if (typeof score !== 'number' || !Number.isFinite(score)) throw new BadRequestException('La calificación debe ser un número');
  if (score < MIN_SCORE || score > MAX_SCORE) throw new BadRequestException('La calificación debe estar entre 0 y 100');
  if (Math.abs(Math.round(score * 100) - score * 100) > 1e-7) {
    throw new BadRequestException('La calificación admite hasta dos decimales');
  }
  return Math.round(score * 100) / 100;
}

export type EvaluationStatus = 'pendiente' | 'completada';

/** `completada` si y solo si hay calificación; con solo comentarios queda `pendiente`. */
export const deriveStatus = (score: number | null): EvaluationStatus => (score === null ? 'pendiente' : 'completada');

export interface EvaluationInput {
  score?: number | null | undefined;
  comments?: string | null | undefined;
}

export interface MergedEvaluation {
  score: number | null;
  comments: string | null;
  status: EvaluationStatus;
}

/** Combina lo guardado con lo recibido (`undefined` = no cambia, `null` = limpia). Exige al menos score o comentarios. */
export function mergeEvaluation(current: { score: number | null; comments: string | null } | null, input: EvaluationInput): MergedEvaluation {
  const score = input.score !== undefined ? (input.score === null ? null : validateScore(input.score)) : (current?.score ?? null);
  const raw = input.comments !== undefined ? input.comments : (current?.comments ?? null);
  const comments = raw === null || raw.trim() === '' ? null : raw.trim();
  if (comments !== null && comments.length > MAX_COMMENTS) throw new BadRequestException(`Los comentarios no pueden pasar de ${MAX_COMMENTS} caracteres`);
  if (score === null && comments === null) throw new BadRequestException('Escribe una calificación o un comentario');
  return { score, comments, status: deriveStatus(score) };
}

// ── Promedios ────────────────────────────────────────────────────────────────

const cents = (n: number) => Math.round(n * 100);
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface ScoredItem {
  score: number | null;
  weight: number | null;
}

/**
 * Promedio de un colaborador: ponderado por peso de sus OKRs EVALUADOS
 * (`suma(score × peso) / suma(peso)`, solo con peso > 0); si ninguno de los
 * evaluados tiene peso mayor a 0, promedio simple; sin evaluados, null.
 */
export function weightedAverage(items: ScoredItem[]): number | null {
  const evaluated = items.filter((i): i is { score: number; weight: number | null } => i.score !== null);
  if (evaluated.length === 0) return null;
  const weighted = evaluated.filter((i) => (i.weight ?? 0) > 0);
  if (weighted.length > 0) {
    const totalWeight = weighted.reduce((a, i) => a + cents(i.weight as number), 0);
    const sum = weighted.reduce((a, i) => a + i.score * cents(i.weight as number), 0);
    return round2(sum / totalWeight);
  }
  return round2(evaluated.reduce((a, i) => a + i.score, 0) / evaluated.length);
}

/** Promedio simple de los valores no nulos; null si no hay ninguno. */
export function simpleAverage(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : round2(present.reduce((a, v) => a + v, 0) / present.length);
}

export interface OkrFact {
  employeeId: string;
  employeeName: string;
  area: string | null;
  period: string;
  weight: number | null;
  score: number | null;
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  area: string | null;
  period: string;
  average: number | null;
  evaluated: number;
  assigned: number;
}
export interface AreaSummary {
  area: string | null;
  period: string;
  average: number | null;
  employees: number;
}
export interface PeriodSummary {
  period: string;
  average: number | null;
  employees: number;
}
export interface ReportSummary {
  evaluated: number;
  assigned: number;
  average: number | null;
  byEmployee: EmployeeSummary[];
  byArea: AreaSummary[];
  byPeriod: PeriodSummary[];
}

/**
 * Resúmenes sobre TODO el conjunto filtrado:
 * - por colaborador (y periodo): promedio ponderado de sus OKRs evaluados;
 * - por área (y periodo): promedio SIMPLE de los promedios de los colaboradores
 *   con promedio (no de las filas de OKR: quien tiene más OKRs no pesa más);
 * - por periodo: promedio simple de los promedios por colaborador de ese periodo;
 * - general: promedio simple de los promedios por colaborador.
 */
export function buildSummary(facts: OkrFact[]): ReportSummary {
  const groups = new Map<string, OkrFact[]>();
  for (const f of facts) {
    const key = `${f.employeeId}|${f.period}`;
    const g = groups.get(key);
    if (g) g.push(f);
    else groups.set(key, [f]);
  }

  const byEmployee: EmployeeSummary[] = [...groups.values()].map((g) => ({
    employeeId: (g[0] as OkrFact).employeeId,
    employeeName: (g[0] as OkrFact).employeeName,
    area: (g[0] as OkrFact).area,
    period: (g[0] as OkrFact).period,
    average: weightedAverage(g),
    evaluated: g.filter((i) => i.score !== null).length,
    assigned: g.length,
  }));
  byEmployee.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'es') || b.period.localeCompare(a.period));

  const areaMap = new Map<string, EmployeeSummary[]>();
  const periodMap = new Map<string, EmployeeSummary[]>();
  for (const e of byEmployee) {
    const ak = `${e.area ?? ''}|${e.period}`;
    const ag = areaMap.get(ak);
    if (ag) ag.push(e);
    else areaMap.set(ak, [e]);
    const pg = periodMap.get(e.period);
    if (pg) pg.push(e);
    else periodMap.set(e.period, [e]);
  }
  const byArea: AreaSummary[] = [...areaMap.values()].map((g) => ({
    area: (g[0] as EmployeeSummary).area,
    period: (g[0] as EmployeeSummary).period,
    average: simpleAverage(g.map((e) => e.average)),
    employees: g.filter((e) => e.average !== null).length,
  }));
  byArea.sort((a, b) => (a.area ?? '').localeCompare(b.area ?? '', 'es') || b.period.localeCompare(a.period));
  const byPeriod: PeriodSummary[] = [...periodMap.entries()]
    .map(([period, g]) => ({ period, average: simpleAverage(g.map((e) => e.average)), employees: g.filter((e) => e.average !== null).length }))
    .sort((a, b) => b.period.localeCompare(a.period));

  return {
    evaluated: facts.filter((f) => f.score !== null).length,
    assigned: facts.length,
    average: simpleAverage(byEmployee.map((e) => e.average)),
    byEmployee,
    byArea,
    byPeriod,
  };
}

// ── Visibilidad de la evaluación (integración con M5) ────────────────────────

export type Viewer = 'rrhh' | 'leader' | 'self';

export interface EvaluationFields {
  score: number | null;
  status: EvaluationStatus;
  comments: string | null;
}

/**
 * Qué parte de la evaluación recibe cada quien. RRHH y el líder directo: todo.
 * El propio colaborador: nada con la bandera apagada (ni siquiera viajan las
 * llaves); con la bandera encendida, calificación y estado, NUNCA comentarios.
 */
export function visibleEvaluation(
  viewer: Viewer,
  ev: EvaluationFields | null,
  scoreVisibleToEmployee: boolean = OKR_SCORE_VISIBLE_TO_EMPLOYEE,
): { score?: number | null; evaluationStatus?: EvaluationStatus; comments?: string | null } {
  const e: EvaluationFields = ev ?? { score: null, status: 'pendiente', comments: null };
  if (viewer === 'self') return scoreVisibleToEmployee ? { score: e.score, evaluationStatus: e.status } : {};
  return { score: e.score, evaluationStatus: e.status, comments: e.comments };
}

// ── Filtros del reporte ──────────────────────────────────────────────────────

export interface ReportFilters {
  period?: string | undefined;
  area?: string | undefined;
  employeeId?: string | undefined;
}

/** Solo empleados activos y OKRs activos y no eliminados. */
export function buildReportWhere(f: ReportFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses = ['o.deleted_at IS NULL', 'o.is_active = true', "e.status = 'active'", 'e.deleted_at IS NULL'];
  if (f.period) {
    params.push(f.period);
    clauses.push(`o.period = $${params.length}`);
  }
  if (f.area) {
    params.push(f.area);
    clauses.push(`e.area = $${params.length}`);
  }
  if (f.employeeId) {
    params.push(f.employeeId);
    clauses.push(`e.id = $${params.length}`);
  }
  return { where: clauses.join(' AND '), params };
}

export const reportFileName = (period: string | undefined): string => `OKRs-${period ?? 'Todos'}.xlsx`;

export function describeFilters(f: ReportFilters, employeeName?: string | null): string {
  return [
    `Periodo: ${f.period ?? 'Todos'}`,
    `Área: ${f.area ?? 'Todas'}`,
    `Colaborador: ${f.employeeId ? (employeeName ?? f.employeeId) : 'Todos'}`,
  ].join(' · ');
}
