'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { CardExpenseReportItem, CardReportStatus, ErrorKind } from '@/lib/api';
import { deleteCardReportAction } from './actions';
import { CARD_STATUS_META, CardStatusBadge, formatDate, maskedCard, money } from './card-shared';

interface Props {
  reports: CardExpenseReportItem[];
  errorKind: ErrorKind | null;
  activeStatus: string;
}

const FILTERS = [
  { value: '', label: 'Todos' },
  ...(Object.keys(CARD_STATUS_META) as CardReportStatus[]).map((s) => ({
    value: s,
    label: CARD_STATUS_META[s].label,
  })),
];

export function MyCardReportsScreen({ reports, errorKind, activeStatus }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<CardExpenseReportItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (errorKind === 'forbidden') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">
          No tienes permiso para ver los reportes de gastos de tarjeta.
        </p>
      </div>
    );
  }

  function runDelete(report: CardExpenseReportItem) {
    setError(null);
    startTransition(async () => {
      const res = await deleteCardReportAction(report.id);
      if (res.success) {
        setConfirming(null);
        router.refresh();
      } else {
        setError(res.error ?? 'No se pudo eliminar el reporte.');
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
          <h1 className="text-2xl font-bold text-navy">Mis gastos de tarjeta</h1>
        </div>
        <Link
          href="/herramientas/mis-gastos-tarjeta/nuevo"
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo reporte de tarjeta
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'todos'}
            type="button"
            onClick={() =>
              router.push(
                f.value
                  ? `/herramientas/mis-gastos-tarjeta?status=${f.value}`
                  : '/herramientas/mis-gastos-tarjeta',
              )
            }
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              activeStatus === f.value
                ? 'border-black bg-black text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No tienes reportes de gastos de tarjeta{activeStatus ? ' con ese estado' : ''}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Número</th>
                  <th className="px-4 py-3 text-left">Tarjeta</th>
                  <th className="px-4 py-3 text-left">Titular</th>
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
                      <Link href={`/herramientas/mis-gastos-tarjeta/${r.id}`} className="hover:underline">
                        {r.reportNumber ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{maskedCard(r.creditCard)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.creditCard?.holderEmployee?.fullName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">
                      {money(r.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <CardStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/herramientas/mis-gastos-tarjeta/${r.id}`}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                        >
                          Ver
                        </Link>
                        {r.status === 'draft' && (
                          <>
                            <Link
                              href={`/herramientas/mis-gastos-tarjeta/${r.id}/editar`}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                            >
                              Editar
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirming(r)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:border-red-300"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-navy">¿Eliminar este borrador?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {confirming.reportNumber} — {money(confirming.totalAmount)}. Esta acción no se puede
              deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={isPending}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => runDelete(confirming)}
                disabled={isPending}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
