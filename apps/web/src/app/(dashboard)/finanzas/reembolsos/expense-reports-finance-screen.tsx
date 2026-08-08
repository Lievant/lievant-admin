'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { ErrorKind, ExpenseReportItem, ExpenseReportStatus } from '@/lib/api';
import {
  formatDate,
  money,
  StatusBadge,
  STATUS_META,
} from '../../herramientas/mis-reembolsos/expense-shared';

interface Props {
  reports: ExpenseReportItem[];
  errorKind: ErrorKind | null;
  activeStatus: string;
  activeRequester: string;
}

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  ...(Object.keys(STATUS_META) as ExpenseReportStatus[]).map((s) => ({
    value: s,
    label: STATUS_META[s].label,
  })),
];

export function ExpenseReportsFinanceScreen({
  reports,
  errorKind,
  activeStatus,
  activeRequester,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(activeRequester);

  if (errorKind === 'forbidden') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">
          Necesitas el permiso <span className="font-mono">finanzas.reembolsos</span> para ver esta
          pantalla.
        </p>
      </div>
    );
  }

  function navigate(status: string, requester: string) {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (requester) qs.set('requester', requester);
    const s = qs.toString();
    router.push(`/finanzas/reembolsos${s ? `?${s}` : ''}`);
  }

  const pendientes = reports.filter((r) => r.status === 'authorized').length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-black">Finanzas</p>
        <h1 className="text-2xl font-bold text-navy">Reembolsos</h1>
        {pendientes > 0 && (
          <p className="mt-1 text-sm text-slate-500">
            {pendientes} reporte{pendientes === 1 ? '' : 's'} autorizado
            {pendientes === 1 ? '' : 's'} esperando pago.
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'todos'}
            type="button"
            onClick={() => navigate(f.value, activeRequester)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              activeStatus === f.value
                ? 'border-black bg-black text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}

        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(activeStatus, search.trim());
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Solicitante o número…"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
          >
            Buscar
          </button>
        </form>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No hay reportes que coincidan con el filtro.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Solicitante</th>
                  <th className="px-4 py-3 text-left">Departamento</th>
                  <th className="px-4 py-3 text-left">Período</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha envío</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      <Link href={`/finanzas/reembolsos/${r.id}`} className="hover:underline">
                        {r.reportNumber ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.requesterEmployee?.fullName ?? r.requester?.name ?? r.requester?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.department ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">
                      {money(r.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/finanzas/reembolsos/${r.id}`}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                          r.status === 'authorized'
                            ? 'border-sky-200 text-sky-700 hover:border-sky-300'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {r.status === 'authorized' ? 'Procesar' : 'Ver'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}
    </div>
  );
}
