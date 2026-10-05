const BUSINESS_TIME_ZONE = 'America/Mexico_City';

/**
 * Fecha de hoy (YYYY-MM-DD) en hora de México.
 *
 * `toISOString().slice(0, 10)` da la fecha en UTC y por la noche ya es mañana;
 * la fecha de negocio es la del reloj de México.
 */
export function todayInMexico(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
