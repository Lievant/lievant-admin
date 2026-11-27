/**
 * SLA y tiempo de atención de "Mis tickets".
 *
 * La meta es la de resolución de la categoría del ticket
 * (helpdesk.categories.sla_resolution_hours). Se mide en tiempo corrido, de la
 * apertura al cierre: el proyecto no tiene una regla de horario hábil ni de
 * días festivos para soporte, así que no se inventa una.
 */

export type SlaTone = 'ok' | 'warning' | 'overdue' | 'met' | 'missed' | 'none';

export interface SlaInput {
  status: string;
  requestedAt: string;
  resolvedAt?: string | null;
  closedAt: string | null;
  /** Meta de resolución de la categoría, en horas. Nula o 0 = sin meta. */
  slaResolutionHours: number | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Con menos de este tramo de la meta por delante, se avisa "Vence en …". */
const WARNING_SHARE = 0.25;

/** "2 h 15 min", "3 d 4 h", "45 min", "menos de 1 min". Usa las dos unidades mayores. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < MINUTE) return 'menos de 1 min';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
}

/** De la apertura al cierre. Solo para tickets cerrados; si no, null. */
export function attentionTime(t: Pick<SlaInput, 'status' | 'requestedAt' | 'closedAt'>): string | null {
  if (t.status !== 'cerrado' || !t.closedAt) return null;
  return formatDuration(new Date(t.closedAt).getTime() - new Date(t.requestedAt).getTime());
}

/** Fin del reloj: el cierre, o la resolución si el ticket quedó "resuelto" esperando confirmación. */
function stopTime(t: SlaInput): number | null {
  if (t.status === 'cerrado' && t.closedAt) return new Date(t.closedAt).getTime();
  if (t.status === 'resuelto' && t.resolvedAt) return new Date(t.resolvedAt).getTime();
  return null;
}

export function slaStatus(t: SlaInput, now: number = Date.now()): { label: string; tone: SlaTone } {
  if (t.status === 'cancelado') return { label: '—', tone: 'none' };
  const metaHours = t.slaResolutionHours ?? 0;
  if (metaHours <= 0) return { label: 'Sin meta', tone: 'none' };

  const start = new Date(t.requestedAt).getTime();
  const meta = metaHours * HOUR;
  const stop = stopTime(t);

  if (stop !== null) {
    return stop - start <= meta ? { label: 'Cumplido', tone: 'met' } : { label: 'Fuera de SLA', tone: 'missed' };
  }
  const remaining = start + meta - now;
  if (remaining <= 0) return { label: 'Vencido', tone: 'overdue' };
  if (remaining <= meta * WARNING_SHARE) return { label: `Vence en ${formatDuration(remaining)}`, tone: 'warning' };
  return { label: 'A tiempo', tone: 'ok' };
}
