'use client';

import type { ExpenseReportItem, ExpenseReportStatus } from '@/lib/api';

// ── formato ──────────────────────────────────────────────────────────────────

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Se parte la cadena a mano: `new Date('2026-03-05')` la corre un día por UTC. */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  return `${formatDate(iso.slice(0, 10))} ${dt.getHours().toString().padStart(2, '0')}:${dt
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export function money(value: string | number | null | undefined): string {
  return Number(value ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// ── estado ───────────────────────────────────────────────────────────────────

export const STATUS_META: Record<ExpenseReportStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Enviado', className: 'bg-amber-100 text-amber-700' },
  authorized: { label: 'Autorizado', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazado', className: 'bg-rose-100 text-rose-700' },
  processed: { label: 'Procesado', className: 'bg-sky-100 text-sky-700' },
};

export function StatusBadge({ status }: { status: ExpenseReportStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// ── encabezado del documento (SGSI) ──────────────────────────────────────────

export function DocumentHeader({
  code = 'FIN-RE-07',
  version = '00',
  classification = 'C2',
  title = 'Reporte de Gastos por Reembolso',
}: {
  code?: string;
  version?: string;
  classification?: string;
  /** Reembolsos y gastos de tarjeta son documentos distintos del mismo SGSI. */
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white">
      <div className="border-b border-slate-200 px-4 py-2 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Sistema de Gestión de Seguridad de la Información
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-base font-bold text-navy">{title}</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <div className="flex gap-1">
            <dt className="font-semibold uppercase">Código:</dt>
            <dd className="font-mono text-navy">{code}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold uppercase">Versión:</dt>
            <dd className="font-mono text-navy">{version}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold uppercase">Clasificación:</dt>
            <dd className="font-mono text-navy">{classification}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ── ayuda contextual ─────────────────────────────────────────────────────────

/**
 * Tooltip nativo: `title` funciona con teclado, lectores de pantalla y táctil
 * sin JS, que es más de lo que daría un popover propio en la primera versión.
 */
export function Hint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      tabIndex={0}
      className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400"
    >
      i
    </span>
  );
}

// ── línea de tiempo del flujo ────────────────────────────────────────────────

export function StatusTimeline({ report }: { report: ExpenseReportItem }) {
  const steps: { label: string; at: string | null; who: string | null; done: boolean }[] = [
    {
      label: 'Creado',
      at: report.createdAt,
      who: report.requesterEmployee?.fullName ?? report.requester?.name ?? null,
      done: true,
    },
    {
      label: 'Enviado',
      at: report.submittedAt,
      who: report.requesterEmployee?.fullName ?? report.requester?.name ?? null,
      done: report.status !== 'draft',
    },
    {
      label: report.status === 'rejected' ? 'Rechazado' : 'Autorizado',
      at: report.authorizedAt,
      who: report.authorizerEmployee?.fullName ?? null,
      done: ['authorized', 'rejected', 'processed'].includes(report.status),
    },
    {
      label: 'Procesado',
      at: report.processedAt,
      who: null,
      done: report.status === 'processed',
    },
  ];

  return (
    <ol className="flex flex-wrap gap-4">
      {steps.map((step) => (
        <li key={step.label} className="flex min-w-[9rem] flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                step.done
                  ? step.label === 'Rechazado'
                    ? 'bg-rose-500'
                    : 'bg-emerald-500'
                  : 'bg-slate-200'
              }`}
            />
            <span
              className={`text-xs font-semibold ${step.done ? 'text-navy' : 'text-slate-400'}`}
            >
              {step.label}
            </span>
          </div>
          <span className="pl-[1.125rem] text-xs text-slate-400">
            {step.done ? formatDateTime(step.at) : 'Pendiente'}
          </span>
          {step.done && step.who && (
            <span className="pl-[1.125rem] text-xs text-slate-400">{step.who}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
