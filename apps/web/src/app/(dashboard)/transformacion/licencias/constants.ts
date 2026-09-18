import type { LicenseStatus } from '@/lib/api';

export const LICENSE_STATUS_LABEL: Record<LicenseStatus, string> = {
  activa: 'Activa',
  pendiente_aprobacion: 'Pendiente de aprobación',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

export const LICENSE_STATUS_STYLE: Record<LicenseStatus, string> = {
  activa: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pendiente_aprobacion: 'bg-amber-50 text-amber-700 ring-amber-200',
  suspendida: 'bg-orange-50 text-orange-700 ring-orange-200',
  cancelada: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export function formatMoney(value: number | null, currency: string | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 2,
  }).format(value);
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

export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}
