export type PositionStatus = 'activo' | 'inactivo' | 'pendiente_aprobacion';
export type Frequency = 'diario' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
export type ActivityFrequency = Frequency | 'eventual';
export type ValidationStatus = 'pendiente' | 'validado' | 'validado_con_ajustes' | 'rechazado';

/** Valor del selector/parámetro que designa los OKRs de plantilla (sin periodo). */
export const BASE_PERIOD = 'base';

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
  /** Categoría: junior, semi_senior o senior. */
  seniority: string | null;
  plazas: number | null;
  /** `plazas = 0`: se muestra como "Vacante". */
  vacant: boolean;
  validationStatus: ValidationStatus;
}

export interface ActivityItem {
  id: string;
  jobPositionId: string;
  groupOrder: number;
  groupTitle: string;
  sortOrder: number;
  description: string;
  frequency: ActivityFrequency | null;
  note: string | null;
}

export interface OkrItem {
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
  /** Texto del nivel como venía en el Excel (solo lectura). */
  levelOriginal: string | null;
  /** Texto de «Reporta a» que venía del Excel (solo lectura). */
  reportsTo: string | null;
  /** «Reporta a» ligado a un empleado; `active: false` = ya no está activo. */
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
  okrs: OkrItem[];
  kpis: KpiItem[];
  activities: ActivityItem[];
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

/** Opciones de las listas de la Matriz (nivel y área salen de catálogos; categoría es una lista cerrada). */
export interface PositionOptions {
  /** Áreas para filtrar: las del catálogo más las que ya usan puestos. */
  areas: string[];
  catalogAreas: { name: string; division: string | null }[];
  businessUnits: string[];
  /** Divisiones activas del catálogo (desplegable del formulario). */
  divisions: string[];
  /** Para el filtro: catálogo más las divisiones antiguas que ya tiene algún puesto. */
  filterDivisions: string[];
  levels: { code: string; name: string }[];
  seniorities: { value: string; label: string }[];
  validationStatuses: ValidationStatus[];
}

export const EMPTY_OPTIONS: PositionOptions = { areas: [], catalogAreas: [], businessUnits: [], divisions: [], filterDivisions: [], levels: [], seniorities: [], validationStatuses: [] };

/** Etiqueta del nivel en los desplegables: «I - Dirección General» (se guarda solo el número romano). */
export const levelOptionLabel = (l: { code: string; name: string }): string => `${l.code} - ${l.name}`;

/** Empleado elegido en «Reporta a». */
export interface ReportsToValue {
  id: string;
  fullName: string;
  position: string | null;
  /** false = el empleado ya no está activo («Baja»). */
  active?: boolean;
}

/** «Nombre (cargo)» y «(Baja)» cuando el empleado ya no está activo. */
export function reportsToLabel(v: ReportsToValue): string {
  return `${v.fullName}${v.position ? ` (${v.position})` : ''}${v.active === false ? ' (Baja)' : ''}`;
}

/** Campos obligatorios del formulario del puesto y su mensaje (el API valida lo mismo con un 400). */
export const REQUIRED_FIELDS = [
  { key: 'roleSummary', label: 'Rol', message: 'El rol es obligatorio' },
  { key: 'positionObjective', label: 'Objetivo del puesto', message: 'El objetivo del puesto es obligatorio' },
  { key: 'validationPoints', label: 'Puntos a validar', message: 'Los puntos a validar son obligatorios' },
  { key: 'description', label: 'Descripción del puesto', message: 'La descripción del puesto es obligatoria' },
] as const;
export type RequiredFieldKey = (typeof REQUIRED_FIELDS)[number]['key'];

/** Mensaje por cada campo obligatorio vacío (solo espacios cuenta como vacío). */
export function requiredErrors(values: Record<RequiredFieldKey, string>): Partial<Record<RequiredFieldKey, string>> {
  const out: Partial<Record<RequiredFieldKey, string>> = {};
  for (const f of REQUIRED_FIELDS) if (values[f.key].trim() === '') out[f.key] = f.message;
  return out;
}

export const SENIORITY_LABELS: Record<string, string> = { junior: 'Junior', semi_senior: 'Semi Senior', senior: 'Senior' };
export const seniorityLabel = (s: string | null): string => (s ? (SENIORITY_LABELS[s] ?? s) : '—');

const plain = (t: string | null | undefined): string => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Áreas del desplegable del formulario: las del catálogo de la división elegida (sin división, todas, sin repetir).
 * Si el puesto ya tiene un área fuera del catálogo (dato antiguo) se ofrece aparte para no perderla al editar.
 */
export function areasForDivision(catalogAreas: PositionOptions['catalogAreas'], division: string): string[] {
  const d = plain(division);
  const names = catalogAreas.filter((a) => d === '' || plain(a.division) === d).map((a) => a.name);
  const seen = new Set<string>();
  return names.filter((n) => (seen.has(plain(n)) ? false : (seen.add(plain(n)), true))).sort((a, b) => a.localeCompare(b, 'es'));
}

export const inList = (list: string[], value: string): boolean => list.some((x) => plain(x) === plain(value));

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
  pendiente: 'Pendiente',
  validado: 'Validado',
  validado_con_ajustes: 'Validado con Ajustes',
  rechazado: 'Rechazado',
};

export const VALIDATION_BADGE: Record<ValidationStatus, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  validado: 'bg-emerald-50 text-emerald-700',
  validado_con_ajustes: 'bg-amber-50 text-amber-700',
  rechazado: 'bg-red-50 text-red-700',
};

export const VALIDATION_STATUSES = Object.keys(VALIDATION_LABELS) as ValidationStatus[];

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

export const ACTIVITY_FREQUENCY_OPTIONS: { value: ActivityFrequency; label: string }[] = [
  ...FREQUENCY_OPTIONS,
  { value: 'eventual', label: 'Eventual' },
];

export const frequencyLabel = (f: ActivityFrequency | null): string => ACTIVITY_FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? '—';

/** "Plantilla (Sin Periodo)" o "Semestre 1 · 2026" según el valor del selector. */
export const okrPeriodLabel = (period: string | null): string => (period === null || period === BASE_PERIOD ? 'Plantilla (Sin Periodo)' : periodLabel(period));

/** Etiqueta del número de plazas: "Vacante" cuando es 0. */
export const plazasLabel = (plazas: number | null): string => (plazas === null ? '—' : plazas === 0 ? 'Vacante' : String(plazas));

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

/** Periodo del selector ('base' = plantilla) → valor del OKR (null = plantilla). */
export const selectorToPeriod = (value: string): string | null => (value === BASE_PERIOD ? null : value);

/** OKRs de un grupo de periodo (la plantilla, sin periodo, es su propio grupo). */
export const okrsOfPeriod = (okrs: OkrItem[], selector: string): OkrItem[] => okrs.filter((o) => o.period === selectorToPeriod(selector));

/** Suma de pesos de los OKRs ACTIVOS de un grupo de periodo (en centésimas, sin errores de coma flotante). */
export function sumPeriodWeights(okrs: OkrItem[], selector: string): number {
  return (
    okrsOfPeriod(okrs, selector)
      .filter((o) => o.isActive)
      .reduce((acc, o) => acc + Math.round((o.weight ?? 0) * 100), 0) / 100
  );
}

/** ¿Algún OKR activo del grupo trae peso? Sin pesos la suma se muestra como "—". */
export const hasAnyWeight = (okrs: OkrItem[], selector: string): boolean =>
  okrsOfPeriod(okrs, selector).some((o) => o.isActive && o.weight !== null);

export interface OkrGroup {
  /** Código del objetivo (O1) o null si los OKRs no lo traen. */
  code: string | null;
  objective: string;
  items: OkrItem[];
}

/** Agrupa por objetivo (mismo código y texto), conservando el orden de aparición. */
export function groupOkrs(okrs: OkrItem[]): OkrGroup[] {
  const groups = new Map<string, OkrGroup>();
  for (const o of okrs) {
    const key = `${o.objectiveCode ?? ''}|${o.objective}`;
    const g = groups.get(key) ?? { code: o.objectiveCode, objective: o.objective, items: [] };
    g.items.push(o);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export interface ActivityGroup {
  order: number;
  title: string;
  items: ActivityItem[];
}

/** Agrupa las actividades por grupo (orden y título), en el orden del grupo y de cada actividad. */
export function groupActivities(activities: ActivityItem[]): ActivityGroup[] {
  const groups = new Map<string, ActivityGroup>();
  for (const a of [...activities].sort((x, y) => x.groupOrder - y.groupOrder || x.sortOrder - y.sortOrder)) {
    const key = `${a.groupOrder}|${a.groupTitle}`;
    const g = groups.get(key) ?? { order: a.groupOrder, title: a.groupTitle, items: [] };
    g.items.push(a);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** "O1 · KR1", "O1" o '' (sin códigos). */
export const okrCode = (o: { objectiveCode?: string | null; krCode?: string | null }): string => [o.objectiveCode, o.krCode].filter(Boolean).join(' · ');

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

/** Guía de llenado (de RRHH) de los cuatro campos de texto del puesto: texto corto junto a la etiqueta y ejemplo como placeholder. */
export type GuidedFieldKey = 'roleSummary' | 'positionObjective' | 'description' | 'validationPoints';
export const FIELD_GUIDES: Record<GuidedFieldKey, { guide: string; placeholder: string }> = {
  roleSummary: {
    guide: 'Qué hace, en una frase.',
    placeholder: 'Ej.: Acompañar a sellers internacionales en su arranque dentro de Mercado Libre.',
  },
  positionObjective: {
    guide: 'Para qué existe.',
    placeholder: 'Ej.: Asegurar que cada seller asignado por Mercado Libre inicie su operación en tiempo y bien preparado para la siguiente etapa.',
  },
  description: {
    guide: 'Actividades y su frecuencia (una por línea).',
    placeholder: [
      '- Contactar a los sellers nuevos y explicarles el programa – Diario',
      '- Dar seguimiento al avance de cada seller – Diario',
      '- Reportar avances a Mercado Libre – Semanal',
    ].join('\n'),
  },
  validationPoints: {
    guide: 'Cómo se mide (uno por línea).',
    placeholder: ['- Sellers contactados en menos de 48 horas', '- Sellers que concluyen su arranque en tiempo', '- Reportes entregados en fecha'].join('\n'),
  },
};

export type TextBlock = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] };

/**
 * Presentación del texto guardado: las líneas que empiezan con «-», «*» o «•» forman listas con viñetas y el resto
 * son párrafos (un salto de línea separa párrafos; las líneas vacías no generan bloques). No modifica el texto
 * guardado y devuelve solo texto, nunca HTML.
 */
export function parseTextBlocks(text: string | null | undefined): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const raw of (text ?? '').split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (line === '') continue;
    const bullet = /^[-*•]\s*(.*)$/.exec(line);
    if (bullet) {
      const item = bullet[1]!.trim();
      if (item === '') continue;
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks;
}
