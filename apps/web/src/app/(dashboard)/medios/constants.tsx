import type { PacingStatus } from '@/lib/api';

// ─── Formato ──────────────────────────────────────────────────────────────────

export function formatMoney(value: number | null | undefined, currency = 'MXN'): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Sin sincronizar';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Semáforos ────────────────────────────────────────────────────────────────

export const STATUS_META: Record<PacingStatus, { label: string; className: string; dot: string }> = {
  green: { label: 'En control', className: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  yellow: { label: 'Precaución', className: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  red: { label: 'Riesgo', className: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  gray: { label: 'Sin datos', className: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

export function StatusBadge({ status }: { status: PacingStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.gray;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export const STATUS_OPTIONS: { value: PacingStatus | ''; label: string }[] = [
  { value: '', label: 'Estado: Todos' },
  { value: 'red', label: '🔴 Riesgo' },
  { value: 'yellow', label: '🟡 Precaución' },
  { value: 'green', label: '🟢 En control' },
  { value: 'gray', label: '⚫ Sin datos' },
];

// ─── Alertas ──────────────────────────────────────────────────────────────────

export const SEVERITY_META: Record<string, { label: string; className: string }> = {
  low: { label: 'Baja', className: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Media', className: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-800' },
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  no_budget: 'Sin presupuesto',
  pacing_yellow: 'Pacing amarillo',
  pacing_red: 'Pacing rojo',
  exhaustion_7d: 'Agotamiento próximo',
  budget_exhausted: 'Presupuesto agotado',
  budget_exceeded: 'Presupuesto excedido',
  stale_data: 'Datos desactualizados',
  pause_failed: 'Fallo al pausar',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  budget_created: 'Presupuesto creado',
  budget_adjusted: 'Presupuesto ajustado',
  campaign_paused: 'Campaña pausada',
  campaign_resumed: 'Campaña reactivada',
  sync_error: 'Error de sincronización',
  token_expired: 'Token expirado',
  alert_sent: 'Alerta enviada',
  alert_acknowledged: 'Alerta reconocida',
  account_created: 'Cuenta creada',
  account_updated: 'Cuenta actualizada',
  sync_triggered: 'Sincronización manual',
};
