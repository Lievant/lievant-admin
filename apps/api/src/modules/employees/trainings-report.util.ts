import { BadRequestException } from '@nestjs/common';
import { DEVELOPMENT_TYPES, isRealDate, type DurationUnit } from './trainings.util';

/** Tipos del filtro del RIAC: los tres de desarrollo más "Reconocimientos" (sin importar su tipo). */
export const RIAC_TYPES = [...DEVELOPMENT_TYPES, 'reconocimientos'] as const;
export type RiacType = (typeof RIAC_TYPES)[number];

export const RIAC_TYPE_LABELS: Record<RiacType, string> = {
  tecnico: 'Técnico',
  habilidades_blandas: 'Habilidades Blandas',
  academico: 'Académico',
  reconocimientos: 'Reconocimientos',
};

export const RIAC_LEVEL_LABELS: Record<string, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
  especializacion: 'Especialización',
};

/** Tope de filas del Excel; por encima se pide acotar los filtros. */
export const RIAC_EXPORT_MAX_ROWS = 20000;
export const RIAC_MAX_RANGE_YEARS = 5;
export const RIAC_DEFAULT_LIMIT = 25;
export const RIAC_MAX_LIMIT = 100;

export interface RiacFilters {
  from: string;
  to: string;
  type?: RiacType | undefined;
  area?: string | undefined;
  division?: string | undefined;
  employeeId?: string | undefined;
}

const toUtc = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};

/** Valida Desde/Hasta: fechas reales, Desde ≤ Hasta y un máximo de 5 años de rango. */
export function validateRiacRange(from: string, to: string): void {
  if (!isRealDate(from)) throw new BadRequestException('La fecha "Desde" no es válida');
  if (!isRealDate(to)) throw new BadRequestException('La fecha "Hasta" no es válida');
  if (from > to) throw new BadRequestException('La fecha "Desde" no puede ser mayor que "Hasta"');
  const limit = toUtc(from);
  limit.setUTCFullYear(limit.getUTCFullYear() + RIAC_MAX_RANGE_YEARS);
  if (toUtc(to) > limit) {
    throw new BadRequestException(`El rango no puede superar ${RIAC_MAX_RANGE_YEARS} años`);
  }
}

/** "40 horas", "1 hora", "6 meses", "1 mes"; vacío si no hay duración. */
export function formatRiacDuration(value: number | null, unit: DurationUnit | null): string {
  if (value === null || unit === null) return '';
  const word = unit === 'horas' ? (value === 1 ? 'hora' : 'horas') : value === 1 ? 'mes' : 'meses';
  return `${value} ${word}`;
}

/** 'AAAA-MM-DD' → 'DD/MM/AAAA' sin pasar por Date (evita corrimientos de zona). */
export function formatRiacDay(day: string | null): string {
  if (!day) return '';
  const [y, m, d] = day.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Nombre del archivo: RIAC-<desde>-<hasta>.xlsx (fechas AAAA-MM-DD). */
export function riacFileName(from: string, to: string): string {
  return `RIAC-${from}-${to}.xlsx`;
}

/** Hoy en la oficina (America/Mexico_City), 'AAAA-MM-DD'. */
export const TODAY_MX_SQL = "(NOW() AT TIME ZONE 'America/Mexico_City')::date";

/**
 * WHERE del reporte. Criterio de TRASLAPE: entra la capacitación cuyo periodo
 * [inicio, fin] toca el rango [desde, hasta]; sin fecha de fin ("En Curso") se
 * considera abierta hasta hoy (o hasta su inicio, si empieza en el futuro).
 * Solo empleados activos y filas sin baja lógica.
 */
export function buildRiacWhere(f: RiacFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [f.from, f.to];
  const clauses = [
    't.deleted_at IS NULL',
    'e.deleted_at IS NULL',
    "e.status = 'active'",
    't.start_date <= $2::date',
    `COALESCE(t.end_date, GREATEST(t.start_date, ${TODAY_MX_SQL})) >= $1::date`,
  ];
  if (f.type === 'reconocimientos') {
    clauses.push('t.is_company_recognition = true');
  } else if (f.type) {
    params.push(f.type);
    clauses.push(`t.development_type = $${params.length}`);
  }
  if (f.area) {
    params.push(f.area);
    clauses.push(`e.area = $${params.length}`);
  }
  if (f.division) {
    params.push(f.division);
    clauses.push(`e.division = $${params.length}`);
  }
  if (f.employeeId) {
    params.push(f.employeeId);
    clauses.push(`e.id = $${params.length}`);
  }
  return { where: clauses.join(' AND '), params };
}

/** Fila cruda de la consulta del reporte (fechas ya como texto). */
export interface RiacRow {
  display_id: string;
  full_name: string;
  area: string | null;
  position: string;
  name: string;
  institution: string;
  development_type: string;
  level: string | null;
  start_date: string;
  end_date: string | null;
  duration_value: number | null;
  duration_unit: DurationUnit | null;
  is_company_recognition: boolean;
  total_count?: string | number;
}

export interface RiacItem {
  employeeDisplayId: string;
  employeeName: string;
  area: string | null;
  position: string;
  name: string;
  institution: string;
  developmentType: string;
  level: string | null;
  startDate: string;
  endDate: string | null;
  duration: string;
  isCompanyRecognition: boolean;
}

export function toRiacItem(r: RiacRow): RiacItem {
  return {
    employeeDisplayId: r.display_id,
    employeeName: r.full_name,
    area: r.area,
    position: r.position,
    name: r.name,
    institution: r.institution,
    developmentType: r.development_type,
    level: r.level,
    startDate: r.start_date,
    endDate: r.end_date,
    duration: formatRiacDuration(r.duration_value, r.duration_unit),
    isCompanyRecognition: r.is_company_recognition,
  };
}

/** Texto de los filtros aplicados para el encabezado del Excel. */
export function describeRiacFilters(f: RiacFilters, employeeName?: string | null): string {
  const parts = [
    `Tipo: ${f.type ? RIAC_TYPE_LABELS[f.type] : 'Todos'}`,
    `Área: ${f.area ?? 'Todas'}`,
    `División: ${f.division ?? 'Todas'}`,
    `Colaborador: ${f.employeeId ? employeeName ?? f.employeeId : 'Todos'}`,
  ];
  return parts.join(' · ');
}
