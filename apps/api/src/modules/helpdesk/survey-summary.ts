import { BadRequestException } from '@nestjs/common';
import { SURVEY_RATINGS, type SurveyRating } from './entities/ticket-survey.entity';

/** Zona de las fechas del resumen: el día de la respuesta en hora de México. */
export const SURVEY_SUMMARY_TZ = 'America/Mexico_City';
export const SURVEY_SUMMARY_DEFAULT_DAYS = 30;
export const SURVEY_SUMMARY_MAX_DAYS = 366;

/**
 * REGLA DE SATISFACCIÓN (cámbiala aquí y solo aquí): qué calificaciones cuentan
 * como "satisfecho". Hoy, solo Feliz: satisfaccionPct = Feliz ÷ respuestas.
 */
export const SATISFIED_RATINGS: readonly SurveyRating[] = ['feliz'];

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Diferencia (ms) entre la hora local de `tz` y UTC en ese instante (México: -6 h). */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante UTC en que empieza el día `ymd` en `tz` (00:00 local). */
export function startOfDayInZone(ymd: string, tz: string = SURVEY_SUMMARY_TZ): Date {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const midnightAsUtc = Date.UTC(y, m - 1, d);
  let t = midnightAsUtc - tzOffsetMs(new Date(midnightAsUtc), tz);
  // Segunda pasada por si el desfase cambia justo ese día (horario de verano).
  t = midnightAsUtc - tzOffsetMs(new Date(t), tz);
  return new Date(t);
}

/** Fecha YYYY-MM-DD de `instant` en `tz`. */
export function ymdInZone(instant: Date, tz: string = SURVEY_SUMMARY_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    instant,
  );
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

function isRealDate(ymd: string): boolean {
  if (!YMD.test(ymd)) return false;
  return addDays(ymd, 0) === ymd;
}

export interface SurveySummaryRange {
  from: string;
  to: string;
  /** Inicio de `from` en hora de México (incluido). */
  start: Date;
  /** Inicio del día siguiente a `to` en hora de México (excluido): `to` entra completo. */
  end: Date;
}

/**
 * Rango del resumen. Sin fechas: los últimos 30 días hasta hoy (México). 400 si
 * una fecha no es YYYY-MM-DD válida, si from > to o si pasa de 366 días.
 */
export function resolveSurveySummaryRange(from?: string, to?: string, now: Date = new Date()): SurveySummaryRange {
  for (const [name, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (value && !isRealDate(value)) {
      throw new BadRequestException(`${name} debe ser una fecha YYYY-MM-DD válida.`);
    }
  }
  const toYmd = to || ymdInZone(now);
  const fromYmd = from || addDays(toYmd, -(SURVEY_SUMMARY_DEFAULT_DAYS - 1));
  if (fromYmd > toYmd) throw new BadRequestException('from no puede ser posterior a to.');
  const days = (Date.parse(toYmd) - Date.parse(fromYmd)) / DAY_MS + 1;
  if (days > SURVEY_SUMMARY_MAX_DAYS) {
    throw new BadRequestException(`El rango no puede pasar de ${SURVEY_SUMMARY_MAX_DAYS} días.`);
  }
  return { from: fromYmd, to: toYmd, start: startOfDayInZone(fromYmd), end: startOfDayInZone(addDays(toYmd, 1)) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** % de satisfacción según SATISFIED_RATINGS. Sin respuestas: null (no 0). */
export function satisfactionPct(counts: Record<SurveyRating, number>, total: number): number | null {
  if (!total) return null;
  const satisfied = SATISFIED_RATINGS.reduce((sum, r) => sum + (counts[r] ?? 0), 0);
  return round1((satisfied / total) * 100);
}

export interface SurveySummary {
  from: string;
  to: string;
  /** Respuestas con fecha (de respuesta) dentro del rango. */
  total: number;
  porCalificacion: Record<SurveyRating, number>;
  satisfaccionPct: number | null;
  /** Tickets con la marca encuesta_solicitada dentro del rango. */
  enviadas: number;
  /** De esas enviadas, cuántas ya tienen respuesta (en cualquier fecha). */
  respondidasDeEnviadas: number;
  /** respondidasDeEnviadas ÷ enviadas. null si no hay respuestas en el rango o no hubo envíos. */
  tasaRespuestaPct: number | null;
}

export function buildSurveySummary(
  range: Pick<SurveySummaryRange, 'from' | 'to'>,
  ratingRows: { rating: string; count: number | string }[],
  sent: { enviadas: number | string; respondidas: number | string },
): SurveySummary {
  const porCalificacion = Object.fromEntries(SURVEY_RATINGS.map((r) => [r, 0])) as Record<SurveyRating, number>;
  for (const row of ratingRows) {
    if ((SURVEY_RATINGS as readonly string[]).includes(row.rating)) {
      porCalificacion[row.rating as SurveyRating] = Number(row.count);
    }
  }
  const total = SURVEY_RATINGS.reduce((sum, r) => sum + porCalificacion[r], 0);
  const enviadas = Number(sent.enviadas) || 0;
  const respondidasDeEnviadas = Number(sent.respondidas) || 0;
  return {
    from: range.from,
    to: range.to,
    total,
    porCalificacion,
    satisfaccionPct: satisfactionPct(porCalificacion, total),
    enviadas,
    respondidasDeEnviadas,
    tasaRespuestaPct: total && enviadas ? round1((respondidasDeEnviadas / enviadas) * 100) : null,
  };
}
