import type {
  ToolBillingPeriod,
  ToolContractStatus,
  ToolCostCenter,
} from '@/lib/api';

/**
 * Etiquetas de presentación. El API manda los valores crudos ('en_negociacion')
 * y la UI es la única que decide cómo se leen, así que el diccionario vive aquí
 * y no en el backend.
 */
export const CONTRACT_STATUS_LABEL: Record<ToolContractStatus, string> = {
  activo: 'Activo',
  en_negociacion: 'En negociación',
  por_cancelar: 'Por cancelar',
  cancelado: 'Cancelado',
};

export const CONTRACT_STATUS_STYLE: Record<ToolContractStatus, string> = {
  activo: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  en_negociacion: 'bg-amber-50 text-amber-700 ring-amber-200',
  por_cancelar: 'bg-orange-50 text-orange-700 ring-orange-200',
  cancelado: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export const BILLING_PERIOD_LABEL: Record<ToolBillingPeriod, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
  unico: 'Pago único',
};

export const COST_CENTER_LABEL: Record<ToolCostCenter, string> = {
  TD: 'Transformación Digital',
  TI: 'Tecnologías de la Información',
  Compartido: 'Compartido',
};

export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  activa: 'Activa',
  pendiente_aprobacion: 'Pendiente de aprobación',
  revocada: 'Revocada',
};

export const ASSIGNMENT_STATUS_STYLE: Record<string, string> = {
  activa: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pendiente_aprobacion: 'bg-amber-50 text-amber-700 ring-amber-200',
  revocada: 'bg-slate-100 text-slate-500 ring-slate-200',
};

/** Formatea con la moneda de la herramienta: MXN y USD no son intercambiables. */
export function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Las fechas DATE llegan como 'YYYY-MM-DD'. Se parten a mano en lugar de pasar
 * por new Date(): ese constructor las interpreta en UTC y en México las corre
 * un día hacia atrás.
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

/** Días que faltan para la renovación; negativo si ya pasó. */
export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
