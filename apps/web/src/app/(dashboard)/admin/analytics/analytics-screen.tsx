'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { AnalyticsSummary, ErrorKind } from '@/lib/api';

interface Props {
  initial: AnalyticsSummary;
  errorKind: ErrorKind | null;
}

const PRESETS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWhen(value: string | null): string {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: string | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? 'text-navy'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function AnalyticsScreen({ initial, errorKind }: Props) {
  const [data, setData] = useState(initial);
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload(dateFrom: string, dateTo: string, preset?: number) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ dateFrom, dateTo });
      const res = await fetch(`/api/audit/analytics/summary?${qs.toString()}`);
      if (!res.ok) throw new Error('No se pudo generar el reporte.');
      setData((await res.json()) as AnalyticsSummary);
      if (preset) setDays(preset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar.');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(d: number) {
    setCustom({ from: '', to: '' });
    void reload(iso(new Date(Date.now() - (d - 1) * 86_400_000)), iso(new Date()), d);
  }

  // La escala del timeline y del heatmap se normaliza al máximo de la serie:
  // con un eje fijo, los días flojos se verían planos y los picos saldrían del
  // cuadro.
  const timelineMax = useMemo(
    () => Math.max(1, ...data.activityTimeline.map((d) => Math.max(d.actions, d.sessions))),
    [data.activityTimeline],
  );
  const heatmapMax = useMemo(
    () => Math.max(1, ...data.moduleHeatmap.map((h) => h.actions)),
    [data.moduleHeatmap],
  );
  const topModule = data.byModule[0] ?? null;

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Analytics de Uso</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.period.from} a {data.period.to}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => applyPreset(p.days)}
              disabled={loading}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                days === p.days && !custom.from
                  ? 'border-navy bg-navy text-white'
                  : 'border-slate-200 text-navy hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={custom.from}
            onChange={(e) => setCustom({ ...custom, from: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <input
            type="date"
            value={custom.to}
            onChange={(e) => setCustom({ ...custom, to: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <button
            onClick={() => custom.from && custom.to && void reload(custom.from, custom.to)}
            disabled={loading || !custom.from || !custom.to}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Cargando…' : 'Aplicar'}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* ── Fila 1 · KPIs ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Usuarios activos"
          value={String(data.activeUsers)}
          hint={`de ${data.totalUsers} con cuenta`}
        />
        <Kpi
          label="Sesiones totales"
          value={String(data.totalSessions)}
          hint={`${data.avgSessionMinutes} min promedio`}
        />
        <Kpi label="Acciones realizadas" value={String(data.totalActions)} />
        <Kpi
          label="Tasa de errores"
          value={`${data.errorRate.percent}%`}
          hint={`${data.errorRate.total} errores`}
          tone={data.errorRate.percent > 2 ? 'text-red-600' : undefined}
        />
      </div>

      {/* ── Fila 2 · Gráficas ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Actividad diaria
          </h2>
          <div className="mt-4 flex h-40 items-end gap-0.5">
            {data.activityTimeline.map((d) => (
              <div
                key={d.date}
                className="group relative flex flex-1 flex-col justify-end gap-0.5"
                title={`${d.date}: ${d.actions} acciones · ${d.sessions} sesiones · ${d.errors} errores`}
              >
                {d.errors > 0 && (
                  <div
                    className="w-full rounded-t bg-red-400"
                    style={{ height: `${(d.errors / timelineMax) * 100}%`, minHeight: 2 }}
                  />
                )}
                <div
                  className="w-full bg-navy"
                  style={{ height: `${(d.actions / timelineMax) * 100}%` }}
                />
                <div
                  className="w-full rounded-b bg-slate-300"
                  style={{ height: `${(d.sessions / timelineMax) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-navy" /> Acciones
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-slate-300" /> Sesiones
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-red-400" /> Errores
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Horas de mayor uso
          </h2>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.moduleHeatmap.map((h) => (
              <div
                key={h.hour}
                className="flex flex-1 flex-col items-center justify-end"
                title={`${h.hour}:00 — ${h.actions} acciones`}
              >
                <div
                  className="w-full rounded-t bg-navy"
                  style={{ height: `${(h.actions / heatmapMax) * 100}%`, minHeight: h.actions > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>
      </div>

      {/* ── Fila 3 · Usuarios ─────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Usuarios más activos
          </h2>
          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                  <th className="px-4 py-3 text-right">Sesiones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Sin actividad en el período.
                    </td>
                  </tr>
                )}
                {data.topUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-navy">{u.userName}</td>
                    <td className="px-4 py-3 text-slate-600">{u.department ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">{u.actions}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {u.sessions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Sin actividad reciente (30+ días)
          </h2>
          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Última actividad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.leastActiveUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      Todos los usuarios han entrado en los últimos 30 días.
                    </td>
                  </tr>
                )}
                {data.leastActiveUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-navy">{u.userName}</td>
                    <td className="px-4 py-3 text-slate-600">{u.department ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatWhen(u.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </div>

      {/* ── Fila 4 · Módulos y departamentos ──────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Uso por módulo
            {topModule && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold normal-case text-emerald-700">
                {topModule.displayName} lidera
              </span>
            )}
          </h2>
          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                  <th className="px-4 py-3 text-right">Usuarios</th>
                  <th className="px-4 py-3">Acción top</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byModule.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Sin actividad en el período.
                    </td>
                  </tr>
                )}
                {data.byModule.map((m) => (
                  <tr key={m.module} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-navy">{m.displayName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">{m.actions}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {m.uniqueUsers}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{m.topAction ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Uso por departamento
          </h2>
          <ScrollableTable>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3 text-right">Usuarios</th>
                  <th className="px-4 py-3 text-right">Sesiones</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byDepartment.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      Sin actividad en el período.
                    </td>
                  </tr>
                )}
                {data.byDepartment.map((d) => (
                  <tr key={d.department} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-navy">{d.department}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{d.users}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {d.sessions}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-navy">{d.actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </div>

      {/* ── Fila 5 · Salud de la plataforma ───────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Salud de la plataforma
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Errores por módulo
            </p>
            {data.errorRate.byModule.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Sin errores en el período.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {data.errorRate.byModule.map((e) => (
                  <li key={e.module} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-navy">{e.module}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{formatWhen(e.lastError)}</span>
                      <span className="font-semibold tabular-nums text-navy">{e.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div
              className={`rounded-xl border p-5 shadow-sm ${
                data.errorRate.criticalUnresolved > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Críticos sin resolver
              </p>
              <p
                className={`mt-1 text-3xl font-bold ${
                  data.errorRate.criticalUnresolved > 0 ? 'text-red-600' : 'text-navy'
                }`}
              >
                {data.errorRate.criticalUnresolved}
              </p>
              <Link
                href="/admin/logs"
                className="mt-2 inline-block text-xs font-semibold text-navy hover:underline"
              >
                Ver en logs →
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sesión promedio
              </p>
              <p className="mt-1 text-3xl font-bold text-navy">
                {data.avgSessionMinutes}
                <span className="ml-1 text-base font-normal text-slate-400">min</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
