'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { EquipmentAuditPage, EquipmentAuditStats, EquipmentAuditTechnician, ErrorKind } from '@/lib/api';
import { AUDIT_STATUS_LABEL, AUDIT_STATUS_STYLE, formatDay } from './constants';
import { useAuditPermissions } from './use-audit-permissions';

interface Filters {
  technicianId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface AuditsScreenProps {
  page: EquipmentAuditPage;
  stats: EquipmentAuditStats;
  technicians: EquipmentAuditTechnician[];
  errorKind: ErrorKind | null;
  filters: Filters;
}

const BASE_PATH = '/transformacion/auditoria-equipos';
const SELECT_CLASS =
  'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-black focus:outline-none';

function StatCard({ label, value, accent, hint }: { label: string; value: number; accent?: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? 'text-navy'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function AuditsScreen({ page, stats, technicians, errorKind, filters }: AuditsScreenProps) {
  const router = useRouter();
  const { canWrite } = useAuditPermissions();

  // Cambiar un filtro vuelve a la primera página; solo la paginación manda `page`.
  function updateParams(overrides: Record<string, string | null>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) sp.set(k, v);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    const qs = sp.toString();
    router.push(`${BASE_PATH}${qs ? `?${qs}` : ''}`);
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  const filtered = Object.values(filters).some(Boolean);

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Auditoría de Equipos</h1>
          <p className="mt-1 text-sm text-slate-500">
            TIC-RE-18 · {page.total} auditoría{page.total !== 1 ? 's' : ''} {filtered ? 'con los filtros aplicados' : 'registradas'}
          </p>
        </div>
        {canWrite && (
          <Link
            href={`${BASE_PATH}/nueva`}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva auditoría
          </Link>
        )}
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          hint={stats.conObservaciones ? `${stats.conObservaciones} con observaciones` : undefined}
        />
        <StatCard
          label="Completadas"
          value={stats.completadas + stats.conObservaciones}
          accent="text-green-600"
          hint={stats.macsSincronizadas ? `${stats.macsSincronizadas} MAC sincronizadas` : undefined}
        />
        <StatCard label="En progreso" value={stats.enProgreso} accent="text-blue-600" />
        <StatCard
          label="Este mes"
          value={stats.thisMonth}
          hint={stats.equiposSinPresencia ? `${stats.equiposSinPresencia} equipos sin presencia` : undefined}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={filters.technicianId}
          onChange={(e) => updateParams({ technicianId: e.target.value || null })}
          className={SELECT_CLASS}
        >
          <option value="">Técnico: Todos</option>
          {technicians.map((t) => (
            <option key={t.userId} value={t.userId}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => updateParams({ status: e.target.value || null })} className={SELECT_CLASS}>
          <option value="">Estado: Todos</option>
          <option value="en_progreso">En progreso</option>
          <option value="completada">Completada</option>
          <option value="con_observaciones">Con observaciones</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Desde
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateParams({ dateFrom: e.target.value || null })}
            className={SELECT_CLASS}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Hasta
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateParams({ dateTo: e.target.value || null })}
            className={SELECT_CLASS}
          />
        </label>
        {filtered && (
          <button
            type="button"
            onClick={() => router.push(BASE_PATH)}
            className="text-sm font-medium text-slate-500 hover:text-black hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Equipos</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    {filtered ? 'No hay auditorías con los filtros aplicados.' : 'Aún no hay auditorías registradas.'}
                  </td>
                </tr>
              ) : (
                page.data.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`${BASE_PATH}/${a.id}`)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-black">{a.auditCode}</td>
                    <td className="px-4 py-3 text-navy">{a.employee.fullName}</td>
                    <td className="px-4 py-3 text-slate-600">{a.employee.area ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{a.technician.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDay(a.auditDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${AUDIT_STATUS_STYLE[a.status]}`}>
                        {AUDIT_STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{a.equipmentCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`${BASE_PATH}/${a.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-medium text-black hover:underline"
                      >
                        {a.status === 'en_progreso' && canWrite ? 'Continuar' : 'Ver'}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {page.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Página {page.page} de {page.totalPages}
          </span>
          <div className="flex gap-2">
            {page.page > 1 && (
              <button
                onClick={() => updateParams({ page: String(page.page - 1) })}
                className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm hover:bg-slate-50"
              >
                ← Anterior
              </button>
            )}
            {page.page < page.totalPages && (
              <button
                onClick={() => updateParams({ page: String(page.page + 1) })}
                className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm hover:bg-slate-50"
              >
                Siguiente →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
