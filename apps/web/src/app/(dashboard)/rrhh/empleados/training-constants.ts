export type DevelopmentType = 'tecnico' | 'habilidades_blandas' | 'academico';
export type TrainingLevel = 'basico' | 'intermedio' | 'avanzado' | 'especializacion';
export type DurationUnit = 'horas' | 'meses';

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
  isCompanyRecognition: boolean;
  hasCertificate: boolean;
  certificateOriginalName?: string | null;
  notes?: string | null;
}

export const DEVELOPMENT_TYPE_OPTIONS: { value: DevelopmentType; label: string }[] = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'habilidades_blandas', label: 'Habilidades Blandas' },
  { value: 'academico', label: 'Académico' },
];

export const LEVEL_OPTIONS: { value: TrainingLevel; label: string }[] = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
  { value: 'especializacion', label: 'Especialización' },
];

export const DURATION_UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: 'horas', label: 'Horas' },
  { value: 'meses', label: 'Meses' },
];

export const RECOGNITION_LABEL = 'Reconocimiento de la Empresa (por ejemplo, aniversario)';

export const CERTIFICATE_ACCEPT = '.pdf,.jpg,.jpeg,.png';
export const CERTIFICATE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null): string =>
  options.find((o) => o.value === value)?.label ?? '—';

export const developmentTypeLabel = (v: DevelopmentType) => labelOf(DEVELOPMENT_TYPE_OPTIONS, v);
export const levelLabel = (v: TrainingLevel | null) => labelOf(LEVEL_OPTIONS, v);

/** '20 Horas', '1 Mes'; '—' si no hay duración. */
export function formatDuration(value: number | null, unit: DurationUnit | null): string {
  if (value === null || unit === null) return '—';
  const singular = unit === 'horas' ? 'Hora' : 'Mes';
  const plural = unit === 'horas' ? 'Horas' : 'Meses';
  return `${value} ${value === 1 ? singular : plural}`;
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
  startDate: string;
  endDate: string;
  durationValue: string;
  durationUnit: string;
}

/** Misma validación que el servidor, para avisar antes de enviar. Devuelve el primer error. */
export function validateTrainingForm(v: TrainingFormValues): string | null {
  if (!v.name.trim()) return 'El nombre del curso o certificado es obligatorio.';
  if (v.name.trim().length > 300) return 'El nombre no puede pasar de 300 caracteres.';
  if (!v.institution.trim()) return 'La institución es obligatoria.';
  if (v.institution.trim().length > 200) return 'La institución no puede pasar de 200 caracteres.';
  if (!v.developmentType) return 'Elige el tipo de desarrollo.';
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
