'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { ErrorKind, SimCard, SimCardPage, SimCardStats, SimPlan } from '@/lib/api';
import {
  SIM_EXPIRY_LABEL,
  SIM_EXPIRY_STYLE,
  SIM_STATUS_LABEL,
  SIM_STATUS_STYLE,
  errorMessageOf,
  formatDay,
  formatMoney,
  formatPhone,
  formatTerm,
} from './constants';
import { SimAssignDialog } from './sim-assign-dialog';
import { SimDetailDrawer } from './sim-detail-drawer';
import { SimFormDialog } from './sim-form-dialog';
import { SimPlansDialog } from './sim-plans-dialog';
import { useSimPermissions } from './use-sim-permissions';

interface Filters {
  search: string;
  status: string;
  planId: string;
  providerId: string;
  assignment: string;
  expiry: string;
}

interface SimCardsScreenProps {
  page: SimCardPage;
  stats: SimCardStats;
  plans: SimPlan[];
  errorKind: ErrorKind | null;
  filters: Filters;
  cursor: string;
  cursorsStack: string[];
}

const BASE_PATH = '/transformacion/sim-cards';
const SELECT_CLASS =
  'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-black focus:outline-none';

function StatCard({
  label,
  value,
  accent,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? 'text-navy'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </>
  );
  if (!onClick) return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left shadow-sm transition ${
        active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'
      }`}
    >
      {body}
    </button>
  );
}

function ExpiryBadge({ sim }: { sim: SimCard }) {
  if (!sim.contractEndDate) return <span className="text-slate-300">—</span>;
  // Una línea cancelada ya no vence: el semáforo no aplica.
  if (sim.status === 'cancelada') return <span className="text-slate-500">{formatDay(sim.contractEndDate)}</span>;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-slate-700">{formatDay(sim.contractEndDate)}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SIM_EXPIRY_STYLE[sim.expiryStatus]}`}>
        {SIM_EXPIRY_LABEL[sim.expiryStatus]}
      </span>
    </div>
  );
}

export function SimCardsScreen({ page, stats, plans, errorKind, filters, cursor, cursorsStack }: SimCardsScreenProps) {
  const router = useRouter();
  const { canWrite } = useSimPermissions();
  const [search, setSearch] = useState(filters.search);
  const [formTarget, setFormTarget] = useState<SimCard | 'new' | null>(null);
  const [assignTarget, setAssignTarget] = useState<SimCard | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SimCard | null>(null);
  const [removing, setRemoving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== filters.search) updateParams({ search: search || null });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Los proveedores salen de los planes: la SIM no tiene proveedor propio.
  const providers = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plans) map.set(p.vendor.id, p.vendor.name ?? '—');
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [plans]);

  function buildParams(overrides: Record<string, string | null>, keepPagination: boolean) {
    const sp = new URLSearchParams();
    if (filters.search) sp.set('search', filters.search);
    if (filters.status) sp.set('status', filters.status);
    if (filters.planId) sp.set('planId', filters.planId);
    if (filters.providerId) sp.set('providerId', filters.providerId);
    if (filters.assignment) sp.set('assignment', filters.assignment);
    if (filters.expiry) sp.set('expiry', filters.expiry);
    if (keepPagination) {
      if (cursor) sp.set('cursor', cursor);
      if (cursorsStack.length) sp.set('cursors', cursorsStack.join(','));
    }
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    });
    return sp;
  }

  function updateParams(overrides: Record<string, string | null>) {
    const qs = buildParams(overrides, false).toString();
    router.push(`${BASE_PATH}${qs ? `?${qs}` : ''}`);
  }

  // `cursorsStack` guarda los cursores de las páginas anteriores, sin la primera
  // (que no lleva cursor): mismo esquema que Inventario Tecnológico.
  function goNext() {
    if (!page.nextCursor) return;
    const sp = buildParams({}, true);
    const stack = cursor ? [...cursorsStack, cursor] : cursorsStack;
    if (stack.length) sp.set('cursors', stack.join(','));
    else sp.delete('cursors');
    sp.set('cursor', page.nextCursor);
    router.push(`${BASE_PATH}?${sp.toString()}`);
  }

  function goPrev() {
    if (isFirstPage) return;
    const sp = buildParams({}, true);
    const stack = [...cursorsStack];
    const prev = stack.pop();
    if (prev) sp.set('cursor', prev);
    else sp.delete('cursor');
    if (stack.length) sp.set('cursors', stack.join(','));
    else sp.delete('cursors');
    router.push(`${BASE_PATH}?${sp.toString()}`);
  }

  const isFirstPage = !cursor;
  const expiringFilterOn = filters.expiry === 'por_vencer';

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sim-cards/${removeTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo dar de baja la línea.'));
      setRemoveTarget(null);
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo dar de baja la línea.');
    } finally {
      setRemoving(false);
    }
  }

  async function unassign(sim: SimCard) {
    setActionError(null);
    try {
      const res = await fetch(`/api/sim-cards/${sim.id}/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo desasignar la línea.'));
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo desasignar la línea.');
    }
  }

  if (errorKind === 'forbidden') return <NoPermissions />;

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Líneas Telefónicas</h1>
          <p className="mt-1 text-sm text-slate-500">
            {page.total} línea{page.total !== 1 ? 's' : ''} {filters.search || filters.status || filters.planId || filters.providerId || filters.assignment || filters.expiry ? 'con los filtros aplicados' : 'registradas'}
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlansOpen(true)}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Administrar planes
            </button>
            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              <PlusIcon className="h-4 w-4" />
              Nueva línea
            </button>
          </div>
        )}
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API.
        </div>
      )}
      {actionError && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{actionError}</div>
      )}

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Líneas activas" value={stats.active} accent="text-green-600" />
        <StatCard
          label="Sin asignar"
          value={stats.unassigned}
          accent="text-blue-600"
          hint="Clic para filtrar"
          active={filters.assignment === 'sin_asignar' && filters.status === 'activa'}
          onClick={() =>
            updateParams(
              filters.assignment === 'sin_asignar' && filters.status === 'activa'
                ? { assignment: null, status: null }
                : { assignment: 'sin_asignar', status: 'activa' },
            )
          }
        />
        <StatCard
          label="Por vencer (30 días)"
          value={stats.expiring}
          accent="text-amber-600"
          hint={expiringFilterOn ? 'Mostrando solo estas · clic para quitar' : 'Clic para filtrar'}
          active={expiringFilterOn}
          onClick={() => updateParams({ expiry: expiringFilterOn ? null : 'por_vencer' })}
        />
        <StatCard label="Costo mensual MXN" value={formatMoney(stats.monthlyCostMXN, 'MXN')} />
        <StatCard label="Costo mensual USD" value={formatMoney(stats.monthlyCostUSD, 'USD')} />
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, número, plan o persona…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select value={filters.status} onChange={(e) => updateParams({ status: e.target.value || null })} className={SELECT_CLASS}>
          <option value="">Estado: Todos</option>
          <option value="activa">Activa</option>
          <option value="suspendida">Suspendida</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <select value={filters.providerId} onChange={(e) => updateParams({ providerId: e.target.value || null })} className={SELECT_CLASS}>
          <option value="">Proveedor: Todos</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select value={filters.planId} onChange={(e) => updateParams({ planId: e.target.value || null })} className={SELECT_CLASS}>
          <option value="">Plan: Todos</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select value={filters.assignment} onChange={(e) => updateParams({ assignment: e.target.value || null })} className={SELECT_CLASS}>
          <option value="">Asignación: Todas</option>
          <option value="asignada">Asignadas</option>
          <option value="sin_asignar">Sin asignar</option>
        </select>

        <select value={filters.expiry} onChange={(e) => updateParams({ expiry: e.target.value || null })} className={SELECT_CLASS}>
          <option value="">Vencimiento: Todos</option>
          <option value="por_vencer">Por vencer (30 días)</option>
          <option value="vencida">Vencidas</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">ID Línea</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Valor del plan</th>
                <th className="px-4 py-3">Plazo</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3">Asignado a</th>
                <th className="px-4 py-3">Fecha de asignación</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {page.data.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-400">
                    No se encontraron líneas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                page.data.map((sim) => (
                  <tr key={sim.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetailId(sim.id)}
                        className="font-mono text-xs font-semibold text-black hover:underline"
                      >
                        {sim.simCode}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{sim.provider?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-navy">{formatPhone(sim.phoneNumber)}</td>
                    <td className="px-4 py-3 text-slate-700">{sim.plan.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatMoney(sim.monthlyCost, sim.currency)}
                      {sim.ownMonthlyCost !== null && <span className="ml-1 text-xs text-slate-400">(propio)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatTerm(sim.termMonths)}</td>
                    <td className="px-4 py-3">
                      <ExpiryBadge sim={sim} />
                    </td>
                    <td className="px-4 py-3">
                      {sim.employee ? (
                        <div className="flex flex-col">
                          <Link
                            href={`/transformacion/inventario/colaboradores/${sim.employee.id}`}
                            className="max-w-[180px] truncate text-navy hover:underline"
                          >
                            {sim.employee.fullName}
                          </Link>
                          {sim.equipment && (
                            <Link
                              href={`/transformacion/inventario/${sim.equipment.id}`}
                              className="font-mono text-xs text-slate-400 hover:underline"
                            >
                              {sim.equipment.displayId}
                            </Link>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-slate-400">Sin asignar</span>
                          {sim.equipment && (
                            <Link
                              href={`/transformacion/inventario/${sim.equipment.id}`}
                              className="font-mono text-xs text-slate-400 hover:underline"
                            >
                              {sim.equipment.displayId}
                            </Link>
                          )}
                        </div>
                      )}
                      {sim.warnings.length > 0 && (
                        <span
                          title={sim.warnings.join('\n')}
                          className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                        >
                          Aviso
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDay(sim.assignedDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SIM_STATUS_STYLE[sim.status]}`}>
                        {SIM_STATUS_LABEL[sim.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" onClick={() => setDetailId(sim.id)} className="text-xs font-medium text-black hover:underline">
                        Ver
                      </button>
                      {canWrite && (
                        <>
                          <button type="button" onClick={() => setFormTarget(sim)} className="ml-3 text-xs font-medium text-black hover:underline">
                            Editar
                          </button>
                          {sim.employee || sim.equipment ? (
                            <button type="button" onClick={() => void unassign(sim)} className="ml-3 text-xs font-medium text-black hover:underline">
                              Desasignar
                            </button>
                          ) : null}
                          {sim.status !== 'cancelada' && (
                            <button type="button" onClick={() => setAssignTarget(sim)} className="ml-3 text-xs font-medium text-black hover:underline">
                              {sim.employee || sim.equipment ? 'Reasignar' : 'Asignar'}
                            </button>
                          )}
                          <button type="button" onClick={() => setRemoveTarget(sim)} className="ml-3 text-xs font-medium text-red-600 hover:underline">
                            Dar de baja
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {/* Paginación */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>{page.data.length > 0 ? `${page.data.length} de ${page.total} registros` : ''}</span>
        <div className="flex gap-2">
          {!isFirstPage && (
            <button onClick={goPrev} className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm hover:bg-slate-50">
              ← Anterior
            </button>
          )}
          {page.nextCursor && (
            <button onClick={goNext} className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm hover:bg-slate-50">
              Siguiente →
            </button>
          )}
        </div>
      </div>

      {formTarget && (
        <SimFormDialog
          sim={formTarget === 'new' ? null : formTarget}
          plans={plans}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            router.refresh();
          }}
        />
      )}
      {assignTarget && (
        <SimAssignDialog
          sim={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null);
            router.refresh();
          }}
        />
      )}
      {detailId && <SimDetailDrawer simId={detailId} onClose={() => setDetailId(null)} />}
      {plansOpen && <SimPlansDialog onClose={() => setPlansOpen(false)} onChanged={() => router.refresh()} />}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy">Dar de baja la línea</h2>
            <p className="mt-2 text-sm text-slate-600">
              Se dará de baja la línea <strong>{removeTarget.simCode}</strong> ({formatPhone(removeTarget.phoneNumber)}).
              {(removeTarget.employee || removeTarget.equipment) && ' Primero se desasignará y quedará en el historial.'} El
              número podrá volver a registrarse.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmRemove()}
                disabled={removing}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? 'Procesando…' : 'Dar de baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
