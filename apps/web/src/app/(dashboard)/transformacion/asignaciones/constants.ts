import type { AssignmentStatus } from '@/lib/api';

/**
 * Umbrales de alerta por días sin uso. Se declaran aquí y no se importan de
 * lib/api: ese módulo arrastra next/headers, y traerlo a un Client Component
 * rompe el build. Los mismos valores viven en el API (tools.constants.ts).
 */
export const UNUSED_WARNING_DAYS = 30;
export const UNUSED_CRITICAL_DAYS = 60;

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  activo: 'Activo',
  revocado: 'Revocado',
};

export const STATUS_STYLE: Record<AssignmentStatus, string> = {
  activo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  revocado: 'bg-slate-100 text-slate-500 ring-slate-200',
};

/**
 * Sin fecha de último uso se pinta rojo, igual que +60 días: una herramienta de
 * la que nunca se registró uso es, para la auditoría, el mismo riesgo que una
 * abandonada — y tratarla como "sin dato" la escondería del tablero.
 */
export function unusedTone(dias: number | null): { style: string; label: string } {
  if (dias === null) return { style: 'bg-red-50 text-red-700 ring-red-200', label: 'Sin registro' };
  if (dias > UNUSED_CRITICAL_DAYS) {
    return { style: 'bg-red-50 text-red-700 ring-red-200', label: `${dias} días` };
  }
  if (dias >= UNUSED_WARNING_DAYS) {
    return { style: 'bg-amber-50 text-amber-700 ring-amber-200', label: `${dias} días` };
  }
  return { style: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: `${dias} días` };
}

/**
 * Las fechas DATE llegan como 'YYYY-MM-DD'. Se parten a mano en vez de pasar por
 * new Date(): ese constructor las lee en UTC y en México las corre un día atrás.
 */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
