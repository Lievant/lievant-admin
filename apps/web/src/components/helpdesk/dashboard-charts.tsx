'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { HelpdeskStats } from '@/lib/api';

const PIE_COLORS = ['#F97316', '#3B82F6', '#6366F1', '#10B981', '#6B7280', '#EF4444'];

const STATUS_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const CATEGORY_LABELS: Record<string, string> = {
  conectividad: 'Conectividad',
  infraestructura: 'Infraestructura',
  seguridad: 'Seguridad',
  equipos: 'Equipos',
  accesos: 'Accesos',
  software: 'Software',
  correo: 'Correo',
  mejora: 'Mejora',
};

function DeltaBadge({ current, prev, higherIsBetter = true }: { current: number | null; prev: number | null; higherIsBetter?: boolean }) {
  if (current == null || prev == null) return null;
  const diff = current - prev;
  if (diff === 0) return null;
  const positive = higherIsBetter ? diff > 0 : diff < 0;
  const pct = prev !== 0 ? Math.abs(Math.round((diff / prev) * 100)) : 0;
  return (
    <span className={`ml-2 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {diff > 0 ? '▲' : '▼'} {pct}%
    </span>
  );
}

function KpiCard({ label, value, delta }: { label: string; value: string | number; delta?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <p className="text-2xl font-bold text-navy">{value}</p>
        {delta}
      </div>
    </div>
  );
}

function isoToday() {
  return new Date().toISOString().split('T')[0];
}

function iso30DaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

export function DashboardCharts() {
  const [from, setFrom] = useState(iso30DaysAgo());
  const [to, setTo] = useState(isoToday());
  const [stats, setStats] = useState<HelpdeskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/helpdesk/stats?from=${from}&to=${to}`)
      .then((r) => r.json() as Promise<HelpdeskStats>)
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  const byStatusData = stats
    ? Object.entries(stats.byStatus).map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v }))
    : [];

  const byCategoryData = stats
    ? Object.entries(stats.byCategory)
        .map(([k, v]) => ({ name: CATEGORY_LABELS[k] ?? k, count: v }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="mt-8 space-y-6">
      {/* Header + date filter */}
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Análisis del período
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:outline-none"
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:outline-none"
          />
        </div>
        {loading && <span className="text-xs text-slate-400">Cargando…</span>}
      </div>

      {/* KPI row */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total tickets"
            value={stats.total}
            delta={<DeltaBadge current={stats.total} prev={stats.prev?.total ?? null} />}
          />
          <KpiCard label="Tickets abiertos" value={stats.openTickets} />
          <KpiCard
            label="SLA cumplido"
            value={stats.slaResolutionRate != null ? `${stats.slaResolutionRate}%` : '—'}
            delta={<DeltaBadge current={stats.slaResolutionRate} prev={stats.prev?.slaResolutionRate ?? null} />}
          />
          <KpiCard
            label="Tiempo prom. cierre"
            value={stats.avgResolutionHours != null ? `${stats.avgResolutionHours.toFixed(1)}h` : '—'}
            delta={
              <DeltaBadge
                current={stats.avgResolutionHours}
                prev={stats.prev?.avgResolutionHours ?? null}
                higherIsBetter={false}
              />
            }
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar — by category */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Tickets por categoría</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategoryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Tickets" fill="#E2714A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie — by status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Distribución por estado</h3>
          {byStatusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie
                    data={byStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {byStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length] ?? '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {byStatusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="flex-1 text-slate-600">{item.name}</span>
                    <span className="font-semibold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">Sin datos</p>
          )}
        </div>
      </div>

      {/* Line — monthly trend */}
      {stats && stats.byMonth.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Tendencia mensual (últimos 7 meses)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.byMonth} margin={{ top: 0, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                name="Tickets"
                stroke="#E2714A"
                strokeWidth={2}
                dot={{ fill: '#E2714A', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top 10 requesters */}
      {stats && stats.top10Requesters.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Top 10 solicitantes</h3>
          <div className="space-y-2">
            {stats.top10Requesters.map((r) => {
              const pct = stats.total > 0 ? Math.round((r.count / stats.total) * 100) : 0;
              return (
                <div key={r.name} className="flex items-center gap-3 text-sm">
                  <span className="w-44 truncate text-slate-700">{r.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-terracota"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold text-slate-600">
                    {r.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
