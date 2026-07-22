'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import type { AccountPacingRow, ErrorKind, MediaPlatform } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { SearchIcon, TableIcon } from '@/components/icons';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPct,
  STATUS_OPTIONS,
  StatusBadge,
} from '../constants';

interface Props {
  slug: string;
  platformMeta: MediaPlatform | null;
  accounts: AccountPacingRow[];
  errorKind: ErrorKind | null;
  filters: { status: string; month: string; search: string };
}

export function PlatformScreen({ slug, platformMeta, accounts, errorKind, filters }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) updateParams({ search: search || undefined });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...patch };
    if (merged.status) params.set('status', merged.status);
    if (merged.month) params.set('month', merged.month);
    if (merged.search) params.set('search', merged.search);
    const qs = params.toString();
    router.push(`/medios/${slug}${qs ? `?${qs}` : ''}`);
  }

  function exportExcel() {
    const data = accounts.map((r) => ({
      Cliente: r.client?.name ?? 'Sin cliente',
      Cuenta: r.nativeAccountName ?? r.nativeAccountId,
      Presupuesto: r.budgetAmount ?? '',
      Gasto: r.spendAccumulated,
      '% Consumido': r.pctConsumed ?? '',
      'Pacing %': r.pacingPct ?? '',
      'Días restantes': r.daysRemaining,
      'Agotamiento (días)': r.daysToExhaustion ?? '',
      'Fecha agotamiento': r.projectedExhaustionDate ?? '',
      'Última actualización': r.lastSyncedAt ?? '',
      Estado: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuentas');
    XLSX.writeFile(wb, `medios_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  const title = platformMeta?.name ?? slug;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Medios</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold text-navy">
            {platformMeta?.color && (
              <span
                className="inline-block h-5 w-5 rounded-full"
                style={{ backgroundColor: platformMeta.color }}
              />
            )}
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{accounts.length} cuentas publicitarias</p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={accounts.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          <TableIcon className="h-4 w-4" />
          Exportar Excel
        </button>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente o cuenta..."
            className="w-64 rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-terracota focus:outline-none"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-terracota focus:outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={filters.month}
          onChange={(e) => updateParams({ month: e.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-terracota focus:outline-none"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Cuenta</th>
                <th className="px-4 py-3 text-right">Presupuesto</th>
                <th className="px-4 py-3 text-right">Gasto</th>
                <th className="px-4 py-3 text-right">% Consumido</th>
                <th className="px-4 py-3 text-right">Pacing</th>
                <th className="px-4 py-3 text-right">Días rest.</th>
                <th className="px-4 py-3 text-right">Agotamiento</th>
                <th className="px-4 py-3">Actualización</th>
                <th className="px-4 py-3">Semáforo</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                    No hay cuentas para esta plataforma con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                accounts.map((r) => (
                  <tr
                    key={r.accountId}
                    onClick={() => router.push(`/medios/cuentas/${r.accountId}`)}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-navy">{r.client?.name ?? 'Sin cliente'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.nativeAccountName ?? r.nativeAccountId}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(r.budgetAmount, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatMoney(r.spendAccumulated, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPct(r.pctConsumed)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPct(r.pacingPct)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.daysRemaining}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.daysToExhaustion !== null ? `${r.daysToExhaustion} d` : '—'}
                      {r.projectedExhaustionDate && (
                        <span className="block text-xs text-slate-400">
                          {formatDate(r.projectedExhaustionDate)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(r.lastSyncedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}
