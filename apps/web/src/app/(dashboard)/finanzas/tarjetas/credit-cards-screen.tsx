'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  EmployeePicker,
  type EmployeePickerValue,
} from '@/app/(dashboard)/rrhh/empleados/employee-picker';
import {
  CARD_STATUS_META,
  CardStatusBadge,
  formatDate,
  maskedCard,
  money,
} from '@/app/(dashboard)/herramientas/mis-gastos-tarjeta/card-shared';
import {
  createCreditCardAction,
  deleteCreditCardAction,
  toggleCreditCardAction,
  updateCreditCardAction,
} from '@/app/(dashboard)/herramientas/mis-gastos-tarjeta/actions';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type {
  CardExpenseReportItem,
  CardReportStatus,
  CreditCardItem,
  ErrorKind,
} from '@/lib/api';

interface Props {
  cards: CreditCardItem[];
  reports: CardExpenseReportItem[];
  errorKind: ErrorKind | null;
  activeTab: 'tarjetas' | 'reportes';
  activeStatus: string;
  activeCardId: string;
}

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  ...(Object.keys(CARD_STATUS_META) as CardReportStatus[]).map((s) => ({
    value: s,
    label: CARD_STATUS_META[s].label,
  })),
];

export function CreditCardsScreen({
  cards,
  reports,
  errorKind,
  activeTab,
  activeStatus,
  activeCardId,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CreditCardItem | 'nueva' | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<CreditCardItem | null>(null);

  if (errorKind === 'forbidden') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">
          Necesitas el permiso <span className="font-mono">finanzas.tarjetas</span> para ver esta
          pantalla.
        </p>
      </div>
    );
  }

  function run(fn: () => Promise<{ success: boolean; error?: string }>, fallback: string) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        setEditing(null);
        setConfirmingDelete(null);
        router.refresh();
      } else {
        setError(res.error ?? fallback);
      }
    });
  }

  function goTab(tab: 'tarjetas' | 'reportes') {
    router.push(tab === 'reportes' ? '/finanzas/tarjetas?tab=reportes' : '/finanzas/tarjetas');
  }

  function filterReports(status: string, cardId: string) {
    const qs = new URLSearchParams({ tab: 'reportes' });
    if (status) qs.set('status', status);
    if (cardId) qs.set('creditCardId', cardId);
    router.push(`/finanzas/tarjetas?${qs.toString()}`);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-black">Finanzas</p>
        <h1 className="text-2xl font-bold text-navy">Tarjetas de Lievant</h1>
      </header>

      <div className="flex gap-1 border-b border-slate-200">
        {(['tarjetas', 'reportes'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => goTab(tab)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? 'border-black text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'tarjetas' ? 'Tarjetas' : 'Reportes de tarjeta'}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {activeTab === 'tarjetas' ? (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setEditing('nueva')}
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <PlusIcon className="h-4 w-4" />
              Nueva tarjeta
            </button>
          </div>

          {cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
              Aún no hay tarjetas registradas.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ScrollableTable>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Últimos 4</th>
                      <th className="px-4 py-3 text-left">Alias</th>
                      <th className="px-4 py-3 text-left">Titular</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cards.map((card) => (
                      <tr key={card.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-slate-700">•••• {card.lastFour}</td>
                        <td className="px-4 py-3 text-slate-600">{card.alias ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {card.holderEmployee?.fullName ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              card.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {card.isActive ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing(card)}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                run(
                                  () => toggleCreditCardAction(card.id),
                                  'No se pudo cambiar el estado.',
                                )
                              }
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:opacity-50"
                            >
                              {card.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDelete(card)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:border-red-300"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value || 'todos'}
                type="button"
                onClick={() => filterReports(f.value, activeCardId)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  activeStatus === f.value
                    ? 'border-black bg-black text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}

            <select
              value={activeCardId}
              onChange={(e) => filterReports(activeStatus, e.target.value)}
              className="ml-auto rounded-md border border-slate-200 px-3 py-1.5 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="">Todas las tarjetas</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  •••• {c.lastFour}
                  {c.alias ? ` — ${c.alias}` : ''}
                </option>
              ))}
            </select>
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
                      <th className="px-4 py-3 text-left">Tarjeta</th>
                      <th className="px-4 py-3 text-left">Titular</th>
                      <th className="px-4 py-3 text-left">Creador</th>
                      <th className="px-4 py-3 text-left">Departamento</th>
                      <th className="px-4 py-3 text-left">Período</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          <Link href={`/finanzas/tarjetas/reportes/${r.id}`} className="hover:underline">
                            {r.reportNumber ?? '—'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">{maskedCard(r.creditCard)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.creditCard?.holderEmployee?.fullName ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.creatorEmployee?.fullName ?? r.creator?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.department ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-navy">
                          {money(r.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <CardStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/finanzas/tarjetas/reportes/${r.id}`}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                              r.status === 'submitted'
                                ? 'border-sky-200 text-sky-700 hover:border-sky-300'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {r.status === 'submitted' ? 'Procesar' : 'Ver'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          )}
        </>
      )}

      {editing && (
        <CardDialog
          card={editing === 'nueva' ? null : editing}
          pending={isPending}
          onCancel={() => setEditing(null)}
          onSave={(payload) =>
            run(
              () =>
                editing === 'nueva'
                  ? createCreditCardAction(payload)
                  : updateCreditCardAction(editing.id, payload),
              'No se pudo guardar la tarjeta.',
            )
          }
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-navy">¿Eliminar esta tarjeta?</h3>
            <p className="mt-2 text-sm text-slate-600">
              •••• {confirmingDelete.lastFour}
              {confirmingDelete.alias ? ` — ${confirmingDelete.alias}` : ''}. Si tiene reportes
              asociados no podrá eliminarse; desactívala en su lugar.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(null)}
                disabled={isPending}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => deleteCreditCardAction(confirmingDelete.id),
                    'No se pudo eliminar la tarjeta.',
                  )
                }
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

function CardDialog({
  card,
  pending,
  onCancel,
  onSave,
}: {
  card: CreditCardItem | null;
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: { lastFour: string; alias?: string; holderEmployeeId: string }) => void;
}) {
  const [lastFour, setLastFour] = useState(card?.lastFour ?? '');
  const [alias, setAlias] = useState(card?.alias ?? '');
  const [holder, setHolder] = useState<EmployeePickerValue | null>(
    card?.holderEmployee
      ? {
          id: card.holderEmployee.id,
          fullName: card.holderEmployee.fullName,
          position: '',
          area: null,
          location: null,
          corporateEmail: null,
        }
      : null,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const fieldClass =
    'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';

  function handleSave() {
    if (!/^\d{4}$/.test(lastFour)) {
      setLocalError('Los últimos 4 dígitos deben ser exactamente 4 números.');
      return;
    }
    if (!holder) {
      setLocalError('Selecciona el titular de la tarjeta.');
      return;
    }
    setLocalError(null);
    onSave({ lastFour, ...(alias.trim() ? { alias: alias.trim() } : {}), holderEmployeeId: holder.id });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-navy">
          {card ? 'Editar tarjeta' : 'Nueva tarjeta'}
        </h3>

        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="last-four">
              Últimos 4 dígitos
            </label>
            <input
              id="last-four"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className={`${fieldClass} font-mono`}
            />
            <p className="text-xs text-slate-400">
              El número completo de la tarjeta nunca se almacena.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="alias">
              Alias
            </label>
            <input
              id="alias"
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="BBVA Empresarial"
              className={fieldClass}
            />
          </div>

          <EmployeePicker label="Titular" value={holder} onSelect={setHolder} />
        </div>

        {localError && <p className="mt-3 text-xs text-rose-600">{localError}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
