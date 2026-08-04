'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ErrorKind, MediaAlertItem } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { CheckIcon } from '@/components/icons';
import { ALERT_TYPE_LABELS, formatDateTime, SEVERITY_META } from '../constants';
import { acknowledgeMediaAlertAction } from './actions';

interface Props {
  alerts: MediaAlertItem[];
  errorKind: ErrorKind | null;
  filters: { status: string; severity: string };
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'active', label: 'Activas' },
  { value: 'acknowledged', label: 'Reconocidas' },
  { value: 'resolved', label: 'Resueltas' },
  { value: '', label: 'Todas' },
];

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Severidad: Todas' },
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Baja' },
];

export function AlertsScreen({ alerts, errorKind, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...patch };
    if (merged.status) params.set('status', merged.status);
    if (merged.severity) params.set('severity', merged.severity);
    const qs = params.toString();
    router.push(`/medios/alertas${qs ? `?${qs}` : ''}`);
  }

  function acknowledge(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await acknowledgeMediaAlertAction(id);
      if (res.success) router.refresh();
      else setError(res.error ?? 'Error al reconocer la alerta.');
    });
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-black">Medios</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Alertas</h1>
        <p className="mt-1 text-sm text-slate-500">{alerts.length} alertas</p>
      </header>

      {/* Tabs + filtro severidad */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => updateParams({ status: tab.value || undefined })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.status === tab.value
                  ? 'bg-black text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={filters.severity}
          onChange={(e) => updateParams({ severity: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {alerts.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No hay alertas con los filtros seleccionados.
        </p>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      SEVERITY_META[a.severity]?.className ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {SEVERITY_META[a.severity]?.label ?? a.severity}
                  </span>
                  <span className="text-sm font-semibold text-navy">
                    {ALERT_TYPE_LABELS[a.alertType] ?? a.alertType}
                  </span>
                  {a.account?.client && (
                    <span className="text-xs text-slate-400">· {a.account.client}</span>
                  )}
                  {a.account?.platform && (
                    <span className="text-xs text-slate-400">· {a.account.platform}</span>
                  )}
                </div>
                <p className="text-sm text-slate-600">{a.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(a.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {a.account?.id && (
                  <Link
                    href={`/medios/cuentas/${a.account.id}`}
                    className="text-xs text-slate-500 hover:text-black"
                  >
                    Ver cuenta →
                  </Link>
                )}
                {a.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => acknowledge(a.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                    Reconocer
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                    {a.status === 'acknowledged' ? 'Reconocida' : 'Resuelta'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
