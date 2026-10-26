export type PositionStatus = 'activo' | 'inactivo' | 'pendiente_aprobacion';
export type Frequency = 'mensual' | 'trimestral' | 'semestral' | 'anual';

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

export interface OkrItem {
  id: string;
  jobPositionId: string;
  period: string;
  objective: string;
  keyResult: string;
  weight: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface KpiItem {
  id: string;
  jobPositionId: string;
  name: string;
  description: string | null;
  targetValue: string | null;
  measurementFrequency: Frequency | null;
  isActive: boolean;
}

export interface PositionDetail extends PositionListItem {
  description: string | null;
  approvedBy: { id: string; name: string | null } | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  okrs: OkrItem[];
  kpis: KpiItem[];
}

export const STATUS_LABELS: Record<PositionStatus, string> = {
  activo: 'Activo',
  pendiente_aprobacion: 'Pendiente Aprobación',
  inactivo: 'Inactivo',
};

export const STATUS_BADGE: Record<PositionStatus, string> = {
  activo: 'bg-emerald-50 text-emerald-700',
  pendiente_aprobacion: 'bg-amber-50 text-amber-700',
  inactivo: 'bg-slate-100 text-slate-500',
};

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

export const frequencyLabel = (f: Frequency | null): string => FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? '—';

/** Año actual en la oficina (America/Mexico_City). */
export function currentYearMx(now: Date = new Date()): number {
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric' }).format(now);
  return Number(y);
}

/** Semestre actual (1 o 2) en la oficina. */
export function currentSemesterMx(now: Date = new Date()): 1 | 2 {
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', month: 'numeric' }).format(now);
  return Number(m) <= 6 ? 1 : 2;
}

/** Periodo del semestre actual: 'AAAA-S1' / 'AAAA-S2'. */
export function currentPeriod(now: Date = new Date()): string {
  return makePeriod(currentYearMx(now), currentSemesterMx(now));
}

export const makePeriod = (year: number, semester: 1 | 2): string => `${year}-S${semester}`;

export function parsePeriod(period: string): { year: number; semester: 1 | 2 } | null {
  const m = /^(\d{4})-S([12])$/.exec(period);
  return m ? { year: Number(m[1]), semester: Number(m[2]) as 1 | 2 } : null;
}

export function periodLabel(period: string): string {
  const p = parsePeriod(period);
  return p ? `Semestre ${p.semester} · ${p.year}` : period;
}

/** Años ofrecidos en el selector: dos antes y uno después del actual, más los que ya tengan datos. */
export function yearOptions(currentYear: number, extra: number[] = []): number[] {
  const set = new Set<number>([currentYear - 2, currentYear - 1, currentYear, currentYear + 1, ...extra]);
  return [...set].sort((a, b) => b - a);
}

/** Suma de pesos de los OKRs ACTIVOS de un periodo (en centésimas, sin errores de coma flotante). */
export function sumPeriodWeights(okrs: OkrItem[], period: string): number {
  return (
    okrs
      .filter((o) => o.period === period && o.isActive)
      .reduce((acc, o) => acc + Math.round((o.weight ?? 0) * 100), 0) / 100
  );
}

export type WeightState = 'empty' | 'complete' | 'incomplete' | 'over';

export function weightState(sum: number, count: number): WeightState {
  if (count === 0) return 'empty';
  if (sum > 100) return 'over';
  return sum === 100 ? 'complete' : 'incomplete';
}

/** 80 → '80 %', 33.5 → '33.5 %'. */
export const formatPct = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} %`;

/** ISO → 'dd/mm/aaaa hh:mm' en America/Mexico_City. */
export function formatDateTimeMx(iso: string | null): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
}
