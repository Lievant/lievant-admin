import { BadRequestException } from '@nestjs/common';

export const DEVELOPMENT_TYPES = ['tecnico', 'habilidades_blandas', 'academico', 'sgsi', 'bienestar_psicosocial'] as const;
export const TRAINING_LEVELS = ['basico', 'intermedio', 'avanzado', 'especializacion', 'obligatoria'] as const;
export const DURATION_UNITS = ['horas', 'dias', 'meses'] as const;

export type DevelopmentType = (typeof DEVELOPMENT_TYPES)[number];
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];
export type DurationUnit = (typeof DURATION_UNITS)[number];

/** El certificado solo admite PDF e imágenes JPEG/PNG. */
export const ALLOWED_CERTIFICATE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const TRAINING_NOT_FOUND = 'Capacitación no encontrada';

/** Tope de competencias por capacitación. */
export const MAX_COMPETENCIES = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Una competencia ligada a una capacitación (`catalogs.competencies`). */
export interface CompetencyRef {
  id: string;
  name: string;
}

/**
 * Las competencias que llegan al guardar: al menos 1, hasta 30, sin repetidas y con ids válidos. El servidor lo exige
 * siempre (el DTO lo valida también, pero el servicio no depende de él).
 */
export function normalizeCompetencyIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('Selecciona al menos una competencia');
  if (ids.length > MAX_COMPETENCIES) {
    throw new BadRequestException(`Una capacitación no puede tener más de ${MAX_COMPETENCIES} competencias`);
  }
  if (!ids.every((i) => typeof i === 'string' && UUID.test(i))) {
    throw new BadRequestException('Alguna competencia elegida no es válida');
  }
  const lower = (ids as string[]).map((i) => i.toLowerCase());
  if (new Set(lower).size !== lower.length) throw new BadRequestException('Hay competencias repetidas');
  return lower;
}

/** Prefijo de S3 de los certificados de un empleado; sirve también para validar pertenencia. */
export function trainingPrefix(employeeId: string): string {
  return `employees/${employeeId}/trainings`;
}

/** Estado de una capacitación que se valida antes de guardarla (ya combinado en un PATCH). */
export interface TrainingState {
  startDate: string;
  endDate: string | null;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  developmentType: string;
  level: string | null;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` que además existe en el calendario (rechaza 2026-02-30). */
export function isRealDate(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Reglas de negocio que no caben en un decorador; el servidor las exige siempre. */
export function validateTraining(t: TrainingState): void {
  if (!(DEVELOPMENT_TYPES as readonly string[]).includes(t.developmentType)) {
    throw new BadRequestException('El tipo de desarrollo no es válido');
  }
  if (t.level !== null && !(TRAINING_LEVELS as readonly string[]).includes(t.level)) {
    throw new BadRequestException('El nivel no es válido');
  }
  if (!isRealDate(t.startDate)) {
    throw new BadRequestException('La fecha de inicio no es válida');
  }
  if (t.endDate !== null) {
    if (!isRealDate(t.endDate)) throw new BadRequestException('La fecha de fin no es válida');
    if (t.endDate < t.startDate) {
      throw new BadRequestException('La fecha de fin no puede ser menor que la de inicio');
    }
  }
  if ((t.durationValue === null) !== (t.durationUnit === null)) {
    throw new BadRequestException('La duración necesita un número y una unidad, o ninguno de los dos');
  }
  if (t.durationValue !== null && (!Number.isInteger(t.durationValue) || t.durationValue <= 0)) {
    throw new BadRequestException('La duración debe ser un entero positivo');
  }
  if (t.durationUnit !== null && !(DURATION_UNITS as readonly string[]).includes(t.durationUnit)) {
    throw new BadRequestException('La unidad de duración no es válida');
  }
}

/** Fila cruda de `employees.employee_trainings` con las fechas ya como texto. */
export interface TrainingRow {
  id: string;
  employee_id: string;
  name: string;
  institution: string;
  development_type: DevelopmentType;
  level: TrainingLevel | null;
  start_date: string;
  end_date: string | null;
  duration_value: number | null;
  duration_unit: DurationUnit | null;
  certificate_s3_key: string | null;
  certificate_original_name: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Columnas con las fechas de negocio como 'YYYY-MM-DD' (sin pasar por Date). */
export const TRAINING_COLUMNS = `id, employee_id, name, institution, development_type, level,
  to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date,
  duration_value, duration_unit, certificate_s3_key,
  certificate_original_name, notes, created_at, updated_at`;

/** Lo que RRHH ve de una capacitación: nunca la llave de S3 ni campos de auditoría. */
export interface TrainingView {
  id: string;
  employeeId: string;
  name: string;
  institution: string;
  developmentType: DevelopmentType;
  level: TrainingLevel | null;
  startDate: string;
  endDate: string | null;
  inProgress: boolean;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  /** Ordenadas por el orden del catálogo y luego por nombre. */
  competencies: CompetencyRef[];
  hasCertificate: boolean;
  certificateOriginalName: string | null;
  notes: string | null;
}

export function toTrainingView(r: TrainingRow, competencies: CompetencyRef[] = []): TrainingView {
  return {
    id: r.id,
    employeeId: r.employee_id,
    name: r.name,
    institution: r.institution,
    developmentType: r.development_type,
    level: r.level,
    startDate: r.start_date,
    endDate: r.end_date,
    inProgress: r.end_date === null,
    durationValue: r.duration_value,
    durationUnit: r.duration_unit,
    competencies,
    hasCertificate: r.certificate_s3_key !== null,
    certificateOriginalName: r.certificate_original_name,
    notes: r.notes,
  };
}

/**
 * Lo que ve el colaborador en Mi Información: lista blanca, sin notas internas
 * de RRHH, sin llave de S3 y sin quién la registró.
 */
export interface MyTrainingView {
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
  competencies: CompetencyRef[];
  hasCertificate: boolean;
}

export function toMyTrainingView(r: TrainingRow, competencies: CompetencyRef[] = []): MyTrainingView {
  return {
    id: r.id,
    name: r.name,
    institution: r.institution,
    developmentType: r.development_type,
    level: r.level,
    startDate: r.start_date,
    endDate: r.end_date,
    inProgress: r.end_date === null,
    durationValue: r.duration_value,
    durationUnit: r.duration_unit,
    competencies,
    hasCertificate: r.certificate_s3_key !== null,
  };
}

/** Filtros del listado: tipo de desarrollo y año de inicio. */
export interface TrainingFilters {
  type?: string;
  year?: number;
}

/** WHERE y parámetros del listado; siempre excluye las dadas de baja. */
export function buildTrainingFilter(
  employeeId: string,
  filters: TrainingFilters,
): { where: string; params: unknown[] } {
  const params: unknown[] = [employeeId];
  let where = 'employee_id = $1 AND deleted_at IS NULL';
  if (filters.type) {
    params.push(filters.type);
    where += ` AND development_type = $${params.length}`;
  }
  if (filters.year !== undefined) {
    params.push(filters.year);
    where += ` AND EXTRACT(YEAR FROM start_date) = $${params.length}`;
  }
  return { where, params };
}

/**
 * TypeORM devuelve `[filas, afectadas]` para UPDATE/DELETE ... RETURNING con el
 * driver de Postgres, y solo las filas para SELECT/INSERT. Esta función entrega
 * la primera fila real en ambos casos (o undefined si no hubo ninguna).
 */
export function firstReturnedRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result)) return undefined;
  const head = result[0];
  if (Array.isArray(head)) return head[0] as T | undefined;
  return head as T | undefined;
}
