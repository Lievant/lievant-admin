'use client';

import Link from 'next/link';
import type { AccountPacingRow, ErrorKind, MediaSummary, PacingStatus } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { AlertIcon } from '@/components/icons';
import { formatDateTime, formatMoney, formatPct, StatusBadge } from './constants';

interface Props {
  summary: MediaSummary | null;
  errorKind: ErrorKind | null;
}

const STATUS_BORDER: Record<PacingStatus, string> = {
  red: 'border-l-red-500',
  yellow: 'border-l-yellow-500',
  green: 'border-l-green-500',
  gray: 'border-l-gray-300',
};

export function MediaDashboardScreen({ summary, errorKind }: Props) {
  if (errorKind === 'forbidden') return <NoPermissions />;

  if (errorKind === 'unavailable' || !summary) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        No se pudo cargar el dashboard de medios. Verifica que el servicio esté disponible e inténtalo de
        nuevo.
      </div>
    );
  }

  const { stats, needsAttention, byClient, platformFreshness, accountsWithoutBudget } = summary;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Medios</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Control de pauta</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dashboard ejecutivo — presupuesto, gasto y pacing del mes en curso.
          </p>
        </div>
        {accountsWithoutBudget > 0 && (
          <Link
            href="/medios/presupuestos"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
          >
            <AlertIcon className="h-4 w-4" />
            {accountsWithoutBudget} cuenta{accountsWithoutBudget === 1 ? '' : 's'} sin presupuesto
          </Link>
        )}
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Presupuesto total del mes" value={formatMoney(stats.totalBudget)} />
        <StatTile label="Gasto acumulado" value={formatMoney(stats.totalSpend)} />
        <StatTile
          label="% consumido"
          value={formatPct(stats.pctConsumed)}
          hint={`${stats.totalAccounts} cuentas activas`}
        />
        <StatTile
          label="Cuentas en riesgo"
          value={String(stats.accountsAtRisk)}
          hint={stats.accountsAtRisk > 0 ? 'Requieren atención' : 'Todo en orden'}
          danger={stats.accountsAtRisk > 0}
        />
      </div>

      {/* Requieren atención */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Requieren atención</h2>
        {needsAttention.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Ninguna cuenta requiere atención inmediata. 🎉
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {needsAttention.map((row) => (
              <AttentionCard key={row.accountId} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* Grid de clientes */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Clientes</h2>
        {byClient.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Aún no hay cuentas publicitarias registradas.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {byClient.map((client) => (
              <div
                key={client.clientId ?? 'sin-cliente'}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-navy">{client.clientName}</p>
                  <StatusBadge status={client.worstStatus} />
                </div>
                <ul className="space-y-1.5">
                  {client.accounts.map((acc) => (
                    <li key={acc.accountId}>
                      <Link
                        href={`/medios/cuentas/${acc.accountId}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2 truncate text-slate-600">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: acc.platform.color ?? '#94a3b8' }}
                          />
                          <span className="truncate">{acc.platform.name}</span>
                        </span>
                        <StatusBadge status={acc.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Frescura por plataforma */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Última actualización por plataforma</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {platformFreshness.map((p) => (
            <div key={p.slug} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-navy">{p.name}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(p.lastSyncedAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${danger ? 'text-red-600' : 'text-navy'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function AttentionCard({ row }: { row: AccountPacingRow }) {
  return (
    <Link
      href={`/medios/cuentas/${row.accountId}`}
      className={`block rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${STATUS_BORDER[row.status]}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{row.client?.name ?? 'Sin cliente'}</p>
          <p className="truncate text-xs text-slate-400">
            {row.platform.name} · {row.nativeAccountName ?? row.nativeAccountId}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <Metric label="Presupuesto" value={formatMoney(row.budgetAmount, row.currency)} />
        <Metric label="Gasto" value={formatMoney(row.spendAccumulated, row.currency)} />
        <Metric label="Consumido" value={formatPct(row.pctConsumed)} />
        <Metric
          label="Agotamiento"
          value={row.daysToExhaustion !== null ? `${row.daysToExhaustion} días` : '—'}
          danger={row.daysToExhaustion !== null && row.daysToExhaustion <= 7}
        />
      </dl>
    </Link>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`font-medium ${danger ? 'text-red-600' : 'text-slate-700'}`}>{value}</dd>
    </div>
  );
}
