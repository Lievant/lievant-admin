'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ErrorKind, MediaAccountDetail } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { ChevronLeftIcon } from '@/components/icons';
import {
  ALERT_TYPE_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPct,
  SEVERITY_META,
  StatusBadge,
} from '../../constants';

interface Props {
  detail: MediaAccountDetail | null;
  errorKind: ErrorKind | null;
}

export function AccountDetailScreen({ detail, errorKind }: Props) {
  const chartData = useMemo(() => {
    if (!detail) return [];
    const ideal = detail.account.spendDailyIdeal ?? 0;
    let cumulative = 0;
    return detail.dailySpend.map((d, i) => {
      cumulative += d.spendMxn;
      const expected = ideal * (i + 1);
      return {
        date: d.date.slice(5),
        acumulado: Math.round(cumulative),
        esperado: Math.round(expected),
        exceso:
          detail.account.budgetAmount !== null && cumulative > detail.account.budgetAmount
            ? Math.round(cumulative - detail.account.budgetAmount)
            : 0,
      };
    });
  }, [detail]);

  if (errorKind === 'forbidden') return <NoPermissions />;
  if (errorKind === 'unavailable' || !detail) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        No se pudo cargar el detalle de la cuenta.
      </div>
    );
  }

  const { account, raw, dailySpend, budgetHistory, alerts } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/medios/cuentas"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-black"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Cuentas
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 rounded-full"
              style={{ backgroundColor: account.platform.color ?? '#94a3b8' }}
            />
            <p className="text-sm font-medium uppercase tracking-wide text-black">
              {account.platform.name}
            </p>
          </div>
          <h1 className="mt-1 text-3xl font-bold text-navy">
            {account.nativeAccountName ?? account.nativeAccountId}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {account.client?.name ?? 'Sin cliente'} ·{' '}
            {account.accountManager ? `AM: ${account.accountManager.name}` : 'Sin AM asignado'}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Presupuesto" value={formatMoney(account.budgetAmount, account.currency)} />
        <KpiCard label="Gasto acumulado" value={formatMoney(account.spendAccumulated, account.currency)} />
        <KpiCard label="Pacing" value={formatPct(account.pacingPct)} />
        <KpiCard
          label="Días a agotamiento"
          value={account.daysToExhaustion !== null ? `${account.daysToExhaustion}` : '—'}
          danger={account.daysToExhaustion !== null && account.daysToExhaustion <= 7}
        />
      </div>

      {/* Gráfica */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-navy">Gasto acumulado vs. esperado</h2>
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            Aún no hay datos de gasto para esta cuenta.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" width={70} />
              <Tooltip
                formatter={(value) =>
                  formatMoney(typeof value === 'number' ? value : Number(value), account.currency)
                }
                labelStyle={{ color: '#0f172a' }}
              />
              <Area
                type="monotone"
                dataKey="exceso"
                stroke="none"
                fill="#ef4444"
                fillOpacity={0.15}
                name="Exceso"
              />
              <Line
                type="monotone"
                dataKey="esperado"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Esperado"
              />
              <Line
                type="monotone"
                dataKey="acumulado"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: '#2563eb', r: 2 }}
                name="Acumulado"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <LegendItem color="#2563eb" label="Gasto real acumulado" />
          <LegendItem color="#94a3b8" label="Gasto esperado (lineal)" dashed />
          <LegendItem color="#ef4444" label="Exceso sobre presupuesto" />
        </div>
      </section>

      {/* Alertas activas */}
      {alerts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-navy">Alertas activas</h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-sm font-medium text-navy">
                    {ALERT_TYPE_LABELS[a.alertType] ?? a.alertType}
                  </p>
                  <p className="text-sm text-slate-500">{a.message}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    SEVERITY_META[a.severity]?.className ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {SEVERITY_META[a.severity]?.label ?? a.severity}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gasto por día */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-navy">Gasto por día (últimos 30 días)</h2>
          <div className="max-h-80 overflow-y-auto">
            <ScrollableTable>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2 text-right">Gasto (MXN)</th>
                    <th className="px-3 py-2 text-right">Nativo</th>
                    <th className="px-3 py-2">Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySpend.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Sin registros de gasto.
                      </td>
                    </tr>
                  ) : (
                    [...dailySpend].reverse().map((d) => (
                      <tr key={d.date} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-600">{formatDate(d.date)}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatMoney(d.spendMxn)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {formatMoney(d.spendNative, d.currency)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400">{d.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </section>

        {/* Historial de presupuestos */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-navy">Historial de presupuestos</h2>
          {budgetHistory.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Sin presupuestos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {budgetHistory.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-navy">
                      {formatDate(b.budgetMonth)}
                      <span className="ml-2 text-xs text-slate-400">v{b.version}</span>
                      {b.isCurrent && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          Vigente
                        </span>
                      )}
                    </p>
                    {b.notes && <p className="text-xs text-slate-400">{b.notes}</p>}
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {formatMoney(b.amount, b.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-400">
        Zona horaria: {raw.timezone} · Última actualización: {formatDateTime(account.lastSyncedAt)}
        {raw.lastSyncError && <span className="text-red-500"> · Error: {raw.lastSyncError}</span>}
      </p>
    </div>
  );
}

function KpiCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${danger ? 'text-red-600' : 'text-navy'}`}>{value}</p>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-0.5 w-5"
        style={{
          backgroundColor: dashed ? 'transparent' : color,
          borderTop: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}
