'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import type {
  AccountPacingRow,
  ErrorKind,
  MediaBudgetItem,
  UpsertMediaBudgetPayload,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { PlusIcon, TableIcon } from '@/components/icons';
import { useCurrentUser } from '@/components/user-provider';
import { formatDate, formatMoney } from '../constants';
import { upsertMediaBudgetAction } from './actions';

interface Props {
  budgets: MediaBudgetItem[];
  accounts: AccountPacingRow[];
  errorKind: ErrorKind | null;
  filters: { month: string };
}

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function BudgetsScreen({ budgets, accounts, errorKind, filters }: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const canWrite =
    (currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false) ||
    (currentUser?.permissions?.some(
      (p) => p.section === 'medios' && p.module === 'presupuestos' && p.action === 'write',
    ) ??
      false);
  const [showForm, setShowForm] = useState(false);

  function updateMonth(month: string) {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    const qs = params.toString();
    router.push(`/medios/presupuestos${qs ? `?${qs}` : ''}`);
  }

  function exportExcel() {
    const data = budgets.map((b) => ({
      Mes: b.budgetMonth,
      Cuenta: b.account?.nativeAccountName ?? b.account?.nativeAccountId ?? b.adAccountId,
      Cliente: b.account?.client ?? '',
      Plataforma: b.account?.platform ?? '',
      Monto: b.amount,
      Moneda: b.currency,
      Versión: b.version,
      Vigente: b.isCurrent ? 'Sí' : 'No',
      Fuente: b.source,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuestos');
    XLSX.writeFile(wb, `medios_presupuestos_${filters.month || 'todos'}.xlsx`);
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Medios</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Presupuestos</h1>
          <p className="mt-1 text-sm text-slate-500">{budgets.length} presupuestos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={budgets.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            <TableIcon className="h-4 w-4" />
            Excel
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              <PlusIcon className="h-4 w-4" />
              Cargar presupuesto
            </button>
          )}
        </div>
      </header>

      <div className="flex items-center gap-3">
        <input
          type="month"
          value={filters.month}
          onChange={(e) => updateMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        {filters.month && (
          <button
            type="button"
            onClick={() => updateMonth('')}
            className="text-sm text-slate-500 hover:text-black"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Mes</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plataforma</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Versión</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {budgets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No hay presupuestos registrados.
                  </td>
                </tr>
              ) : (
                budgets.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDate(b.budgetMonth)}</td>
                    <td className="px-4 py-3 font-medium text-navy">
                      {b.account?.nativeAccountName ?? b.account?.nativeAccountId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.account?.client ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{b.account?.platform ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">
                      {formatMoney(b.amount, b.currency)}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">v{b.version}</td>
                    <td className="px-4 py-3">
                      {b.isCurrent ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          Vigente
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                          Histórico
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {showForm && (
        <BudgetFormModal
          accounts={accounts}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function BudgetFormModal({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: AccountPacingRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [adAccountId, setAdAccountId] = useState(accounts[0]?.accountId ?? '');
  const [budgetMonth, setBudgetMonth] = useState(defaultMonth());
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const amountNum = Number(amount);
    if (!adAccountId || !budgetMonth || !amountNum || amountNum <= 0) {
      setError('Cuenta, mes y monto válido son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: UpsertMediaBudgetPayload = {
      adAccountId,
      budgetMonth: `${budgetMonth}-01`,
      amount: amountNum,
      currency,
      source: 'manual',
    };
    if (notes.trim()) payload.notes = notes.trim();
    const res = await upsertMediaBudgetAction(payload);
    setSubmitting(false);
    if (res.success) onSaved();
    else setError(res.error ?? 'Error al guardar el presupuesto.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-navy">Cargar presupuesto</h2>
        <p className="mb-4 text-xs text-slate-400">
          Si ya existe un presupuesto para la cuenta y mes, se creará una nueva versión.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Cuenta</span>
            <select
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {accounts.length === 0 && <option value="">Sin cuentas disponibles</option>}
              {accounts.map((a) => (
                <option key={a.accountId} value={a.accountId}>
                  {a.platform.name} — {a.client?.name ?? a.nativeAccountName ?? a.nativeAccountId}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Mes</span>
              <input
                type="month"
                value={budgetMonth}
                onChange={(e) => setBudgetMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Moneda</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Monto</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Notas (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
