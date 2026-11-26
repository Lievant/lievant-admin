import type { TicketPriority, TicketStatus } from '@/lib/api';
import type { SlaTone } from './ticket-sla';

export const PRIORITY_STYLES: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-emerald-100 text-emerald-700',
};

export const STATUS_STYLES: Record<TicketStatus, string> = {
  abierto: 'bg-amber-100 text-amber-700',
  en_atencion: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-50 text-red-400',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

export const SLA_TONE_STYLES: Record<SlaTone, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
  met: 'bg-emerald-50 text-emerald-700',
  missed: 'bg-red-50 text-red-700',
  none: 'text-slate-400',
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}
