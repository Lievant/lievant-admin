export type DevelopmentType = 'tecnico' | 'habilidades_blandas' | 'academico' | 'sgsi' | 'bienestar_psicosocial';
export type TrainingLevel = 'basico' | 'intermedio' | 'avanzado' | 'especializacion' | 'obligatoria';
export type DurationUnit = 'horas' | 'dias' | 'meses';

/** Capacitación tal como la entrega el API (a RRHH `notes` viene; al colaborador no). */
export interface TrainingItem {
  id: string;
  name: string;
  institution: string;
  developmentType: DevelopmentType;
  level: TrainingLevel | null;
  startDate: string;
  endDate: string | null;
  inProgress: boolean;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  /** Por el orden del catálogo y luego por nombre. */
  competencies: { id: string; name: string }[];
  hasCertificate: boolean;
  certificateOriginalName?: string | null;
  notes?: string | null;
}

export const DEVELOPMENT_TYPE_OPTIONS: { value: DevelopmentType; label: string }[] = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'habilidades_blandas', label: 'Habilidades Blandas' },
  { value: 'academico', label: 'Académico' },
  { value: 'sgsi', label: 'Sistema de Gestión de Seguridad de la Información' },
  { value: 'bienestar_psicosocial', label: 'Bienestar y Factores Psicosociales' },
];

export const LEVEL_OPTIONS: { value: TrainingLevel; label: string }[] = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
  { value: 'especializacion', label: 'Especialización' },
  { value: 'obligatoria', label: 'Obligatoria' },
];

export const DURATION_UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: 'horas', label: 'Horas' },
  { value: 'dias', label: 'Días' },
  { value: 'meses', label: 'Meses' },
];

/** Tope de competencias por capacitación (el servidor lo exige igual). */
export const MAX_COMPETENCIES = 30;
export const COMPETENCY_REQUIRED = 'Selecciona al menos una competencia';

export const CERTIFICATE_ACCEPT = '.pdf,.jpg,.jpeg,.png';
export const CERTIFICATE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null): string =>
  options.find((o) => o.value === value)?.label ?? '—';

export const developmentTypeLabel = (v: DevelopmentType) => labelOf(DEVELOPMENT_TYPE_OPTIONS, v);
export const levelLabel = (v: TrainingLevel | null) => labelOf(LEVEL_OPTIONS, v);

const DURATION_WORDS: Record<DurationUnit, [string, string]> = { horas: ['Hora', 'Horas'], dias: ['Día', 'Días'], meses: ['Mes', 'Meses'] };

/** '20 Horas', '1 Día', '5 Días', '1 Mes'; '—' si no hay duración. */
export function formatDuration(value: number | null, unit: DurationUnit | null): string {
  if (value === null || unit === null) return '—';
  return `${value} ${DURATION_WORDS[unit][value === 1 ? 0 : 1]}`;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sin pasar por Date (evita el corrimiento de zona horaria). */
export function formatDay(day: string | null): string {
  if (!day) return '—';
  const [y, m, d] = day.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** '01/03/2026 – En Curso' o '01/03/2026 – 15/04/2026'. */
export function formatRange(startDate: string, endDate: string | null): string {
  return `${formatDay(startDate)} – ${endDate ? formatDay(endDate) : 'En Curso'}`;
}

/** Años de inicio presentes en las capacitaciones, del más reciente al más antiguo. */
export function yearsOf(items: { startDate: string }[]): number[] {
  return [...new Set(items.map((i) => Number(i.startDate.slice(0, 4))))].sort((a, b) => b - a);
}

/** Query string de los filtros; vacío si no hay ninguno. */
export function trainingQuery(type: string, year: string): string {
  const q = new URLSearchParams();
  if (type) q.set('type', type);
  if (year) q.set('year', year);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export interface TrainingFormValues {
  name: string;
  institution: string;
  developmentType: string;
  level: string;
  competencyIds: string[];
  startDate: string;
  endDate: string;
  durationValue: string;
  durationUnit: string;
}

/** Misma validación que el servidor, para avisar antes de enviar. Devuelve el primer error. */
export function validateTrainingForm(v: TrainingFormValues): string | null {
  if (!v.name.trim()) return 'El nombre del curso o certificado es obligatorio.';
  if (v.name.trim().length > 300) return 'El nombre no puede pasar de 300 caracteres.';
  if (!v.developmentType) return 'Elige el tipo de desarrollo.';
  if (v.competencyIds.length === 0) return COMPETENCY_REQUIRED;
  if (v.competencyIds.length > MAX_COMPETENCIES) return `No puedes elegir más de ${MAX_COMPETENCIES} competencias.`;
  if (!v.institution.trim()) return 'La institución es obligatoria.';
  if (v.institution.trim().length > 200) return 'La institución no puede pasar de 200 caracteres.';
  if (!v.startDate) return 'La fecha de inicio es obligatoria.';
  if (v.endDate && v.endDate < v.startDate) return 'La fecha de fin no puede ser menor que la de inicio.';
  const hasValue = v.durationValue.trim() !== '';
  if (hasValue !== (v.durationUnit !== '')) return 'La duración necesita un número y una unidad, o ninguno de los dos.';
  if (hasValue) {
    const n = Number(v.durationValue);
    if (!Number.isInteger(n) || n <= 0) return 'La duración debe ser un número entero positivo.';
  }
  return null;
}
