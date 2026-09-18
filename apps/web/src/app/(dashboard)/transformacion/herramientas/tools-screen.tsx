'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { useCurrentUser } from '@/components/user-provider';
import type { ErrorKind, ToolOptions, ToolRecord, ToolStats } from '@/lib/api';
import { ToolDialog } from './tool-dialog';
import {
  BILLING_PERIOD_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_STYLE,
  COST_CENTER_LABEL,
  daysUntil,
  formatDate,
  formatMoney,
} from './constants';

interface Filters {
  search: string;
  category: string;
  contractStatus: string;
  costCenter: string;
}

interface ToolsScreenProps {
  tools: ToolRecord[];
  stats: ToolStats;
  options: ToolOptions;
  filters: Filters;
  errorKind: ErrorKind | null;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function RenewalCell({ date }: { date: string | null }) {
  const days = daysUntil(date);
  if (days === null) return <span className="text-slate-400">—</span>;

  // Solo se pinta lo que pide acción: vencido o dentro de 30 días. Colorear
  // todas las fechas dejaría la columna sin jerarquía.
  const tone =
    days < 0 ? 'text-red-600 font-semibold' : days <= 30 ? 'text-amber-600 font-semibold' : 'text-navy';

  return (
    <span className={tone}>
      {formatDate(date)}
      {days < 0 && <span className="ml-1 text-xs">(vencida)</span>}
      {days >= 0 && days <= 30 && <span className="ml-1 text-xs">({days} d)</span>}
    </span>
  );
}

export function ToolsScreen({ tools, stats, options, filters, errorKind }: ToolsScreenProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const [search, setSearch] = useState(filters.search);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Sin usuario resuelto se asume que puede: mismo criterio que el sidebar, para
  // que un fallo de /auth/me no esconda el botón en vez de fallar al guardar.
  const canWrite =
    !user ||
    user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
    user.permissions.some(
      (p) => p.section === 'transformacion' && p.module === 'herramientas' && p.action === 'write',
    );

  if (errorKind === 'forbidden') return <NoPermissions />;

  function applyFilter(key: keyof Filters, value: string) {
    const params = new URLSearchParams();
    const next: Filters = { ...filters, [key]: value };
    if (next.search) params.set('search', next.search);
    if (next.category) params.set('category', next.category);
    if (next.contractStatus) params.set('contractStatus', next.contractStatus);
    if (next.costCenter) params.set('costCenter', next.costCenter);
    const qs = params.toString();
    router.push(`/transformacion/herramientas${qs ? `?${qs}` : ''}`);
  }

  const currencies = Object.keys(stats.monthlyCostByCurrency).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Catálogo de Herramientas y Licencias</h1>
          <p className="mt-1 text-sm text-slate-500">
            Costo, facturación y asignación de cada herramienta contratada.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva herramienta
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Herramientas" value={String(stats.total)} />
        <StatCard label="Asignaciones activas" value={String(stats.activeAssignments)} />
        <StatCard
          label="Gasto mensual"
          value={
            currencies.length
              ? currencies
                  .map((c) => formatMoney(stats.monthlyCostByCurrency[c] ?? 0, c))
                  .join(' · ')
              : '—'
          }
          hint="Anualizado ÷ 12, por moneda"
        />
        <StatCard
          label="Renuevan en 30 días"
          value={String(stats.renewingIn30Days)}
          hint="Contratos no cancelados"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilter('search', search);
            }}
            placeholder="Buscar por nombre, proveedor o código…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-navy"
          />
        </div>

        <select
          value={filters.category}
          onChange={(e) => applyFilter('category', e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
        >
          <option value="">Todas las categorías</option>
          {options.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filters.contractStatus}
          onChange={(e) => applyFilter('contractStatus', e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
        >
          <option value="">Todos los estados</option>
          {options.contractStatuses.map((s) => (
            <option key={s} value={s}>
              {CONTRACT_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>

        <select
          value={filters.costCenter}
          onChange={(e) => applyFilter('costCenter', e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
        >
          <option value="">Todos los centros</option>
          {options.costCenters.map((c) => (
            <option key={c} value={c}>
              {COST_CENTER_LABEL[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      <ScrollableTable>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Herramienta</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3 text-right">Costo unitario</th>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3 text-right">Licencias</th>
              <th className="px-4 py-3 text-right">Costo total</th>
              <th className="px-4 py-3">Centro</th>
              <th className="px-4 py-3">Renovación</th>
              <th className="px-4 py-3">Contrato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tools.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                  No hay herramientas que coincidan con los filtros.
                </td>
              </tr>
            )}
            {tools.map((tool) => (
              <tr key={tool.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{tool.toolCode}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/transformacion/herramientas/${tool.id}`}
                    className="font-medium text-navy hover:underline"
                  >
                    {tool.name}
                  </Link>
                  {tool.requiresApproval && (
                    <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset bg-indigo-50 text-indigo-700 ring-indigo-200">
                      Aprobación
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{tool.category}</td>
                <td className="px-4 py-3 text-slate-600">{tool.provider}</td>
                <td className="px-4 py-3 text-right tabular-nums text-navy">
                  {formatMoney(tool.unitCost, tool.currency)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {BILLING_PERIOD_LABEL[tool.billingPeriod] ?? tool.billingPeriod}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-navy">
                  {tool.activeAssignmentsCount}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-navy">
                  {formatMoney(tool.totalCostCalculated, tool.currency)}
                </td>
                <td className="px-4 py-3 text-slate-600">{tool.costCenter}</td>
                <td className="px-4 py-3">
                  <RenewalCell date={tool.nextRenewalDate} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      CONTRACT_STATUS_STYLE[tool.contractStatus] ??
                      'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {CONTRACT_STATUS_LABEL[tool.contractStatus] ?? tool.contractStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>

      {dialogOpen && (
        <ToolDialog options={options} open={dialogOpen} onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}
