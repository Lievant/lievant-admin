import Link from 'next/link';
import { getHelpdeskStats, type HelpdeskStats } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DashboardCharts } from '@/components/helpdesk/dashboard-charts';

async function safeStats(): Promise<HelpdeskStats | null> {
  try {
    return await getHelpdeskStats();
  } catch {
    return null;
  }
}

export default async function TransformacionPage() {
  const stats = await safeStats();

  const abiertos = stats?.byStatus['abierto'] ?? 0;
  const enAtencion = stats?.byStatus['en_atencion'] ?? 0;
  const enRevision = stats?.byStatus['en_revision'] ?? 0;
  const cerrados = stats?.byStatus['cerrado'] ?? 0;
  const activos = abiertos + enAtencion + enRevision;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-black">
          Transformación Digital
        </p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
      </header>

      {/* Fila 1 — 4 KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Tickets activos"
          value={stats ? String(activos) : '—'}
          description="Abiertos + en revisión"
        />
        <KpiCard
          label="Sin atender"
          value={stats ? String(abiertos) : '—'}
          description="Abiertos sin técnico"
          {...(abiertos > 0 ? { accent: 'text-amber-600' } : {})}
        />
        <KpiCard
          label="SLA vencido"
          value="—"
          description="Tickets fuera de SLA"
          accent="text-red-500"
        />
        <KpiCard
          label="SLA cumplido"
          value={stats?.slaResolutionRate != null ? `${stats.slaResolutionRate}%` : '—'}
          description="Resolución en tiempo"
          accent="text-emerald-600"
        />
      </div>

      {/* Fila 2 — Distribución por estado */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <StatusCard
          label="Abiertos"
          value={abiertos}
          badgeClass="bg-amber-100 text-amber-700"
          available={stats !== null}
        />
        <StatusCard
          label="En revisión"
          value={enRevision + enAtencion}
          badgeClass="bg-blue-100 text-blue-700"
          available={stats !== null}
        />
        <StatusCard
          label="Cerrados"
          value={cerrados}
          badgeClass="bg-slate-100 text-slate-600"
          available={stats !== null}
        />
      </div>

      {/* Accesos rápidos */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/transformacion/tickets"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy shadow-sm hover:border-black hover:text-black"
          >
            <i className="ti ti-ticket text-lg leading-none" />
            Ver todos los tickets
          </Link>
          <Link
            href="/transformacion/tickets/nuevo"
            className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <i className="ti ti-plus text-lg leading-none" />
            Nuevo ticket
          </Link>
        </div>
      </div>

      {/* Dashboard ejecutivo — gráficos interactivos */}
      <DashboardCharts />

      {/* Distribución por prioridad */}
      {stats && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Distribución por prioridad</h2>
          <div className="flex gap-4">
            {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => {
              const count = stats.byPriority[p] ?? 0;
              return (
                <div key={p} className="flex-1 text-center">
                  <div
                    className={cn(
                      'mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
                      p === 'P1' && 'bg-red-100 text-red-600',
                      p === 'P2' && 'bg-orange-100 text-orange-600',
                      p === 'P3' && 'bg-yellow-100 text-yellow-700',
                      p === 'P4' && 'bg-emerald-100 text-emerald-600',
                    )}
                  >
                    {count}
                  </div>
                  <p className="text-xs font-medium text-slate-500">{p}</p>
                </div>
              );
            })}
          </div>
          {stats.avgResolutionHours != null && (
            <p className="mt-4 text-xs text-slate-400">
              Tiempo promedio de resolución:{' '}
              <span className="font-semibold text-slate-600">
                {stats.avgResolutionHours.toFixed(1)}h
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold text-navy', accent)}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  badgeClass,
  available,
}: {
  label: string;
  value: number;
  badgeClass: string;
  available: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badgeClass)}>
          {label}
        </span>
      </div>
      <p className="mt-3 text-4xl font-bold text-navy">{available ? value : '—'}</p>
    </div>
  );
}
