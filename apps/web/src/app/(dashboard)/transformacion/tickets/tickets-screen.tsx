'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ErrorKind, HelpdeskCategorySummary, TicketPage, TicketPriority, TicketStatus, TicketSummary } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { deleteTicketAction } from './actions';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortableColumns } from '@/hooks/use-sortable-columns';
import { useCurrentUser } from '@/components/user-provider';

const SLA_HOURS: Record<TicketPriority, number> = { P1: 4, P2: 8, P3: 24, P4: 72 };

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-emerald-100 text-emerald-700',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  abierto: 'bg-amber-100 text-amber-700',
  en_atencion: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const CATEGORY_ICONS: Record<string, string> = {
  conectividad: 'ti-wifi',
  infraestructura: 'ti-server',
  seguridad: 'ti-shield-lock',
  equipos: 'ti-device-laptop',
  accesos: 'ti-key',
  software: 'ti-apps',
  correo: 'ti-mail',
  mejora: 'ti-sparkles',
};

function slaLight(ticket: TicketSummary): 'verde' | 'amarillo' | 'rojo' | null {
  if (!ticket.priority || ticket.status === 'cerrado' || ticket.status === 'cancelado') return null;
  const limit = SLA_HOURS[ticket.priority];
  if (!limit) return null;
  const start = new Date(ticket.requestedAt).getTime();
  const elapsed = (Date.now() - start) / 3_600_000;
  const pct = elapsed / limit;
  if (pct >= 1) return 'rojo';
  if (pct >= 0.75) return 'amarillo';
  return 'verde';
}

interface Filters {
  status: string;
  priority: string;
  category: string;
  search: string;
  slaStatus: string;
}

interface TicketsScreenProps {
  page: TicketPage;
  categories: HelpdeskCategorySummary[];
  isTd: boolean;
  filters: Filters;
  cursor: string;
  cursorsStack: string[];
  errorKind: ErrorKind | null;
}

export function TicketsScreen({
  page,
  categories,
  isTd,
  filters,
  cursor,
  cursorsStack,
  errorKind,
}: TicketsScreenProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; displayId: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.search);

  useEffect(() => { setSearch(filters.search); }, [filters.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== filters.search) updateParams({ search: search || null });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function buildParams(overrides: Record<string, string | null>, keepPagination: boolean) {
    const sp = new URLSearchParams();
    if (filters.status) sp.set('status', filters.status);
    if (filters.priority) sp.set('priority', filters.priority);
    if (filters.category) sp.set('category', filters.category);
    if (filters.search) sp.set('search', filters.search);
    if (filters.slaStatus) sp.set('slaStatus', filters.slaStatus);
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
    const sp = buildParams(overrides, false);
    const qs = sp.toString();
    router.push(`/transformacion/tickets${qs ? `?${qs}` : ''}`);
  }

  function goNext() {
    if (!page.nextCursor) return;
    const sp = buildParams({}, true);
    sp.set('cursors', [...cursorsStack, cursor].join(','));
    sp.set('cursor', page.nextCursor);
    router.push(`/transformacion/tickets?${sp.toString()}`);
  }

  function goPrev() {
    if (cursorsStack.length === 0) return;
    const stack = [...cursorsStack];
    const prev = stack.pop() ?? '';
    const sp = buildParams({}, true);
    if (prev) sp.set('cursor', prev); else sp.delete('cursor');
    if (stack.length) sp.set('cursors', stack.join(',')); else sp.delete('cursors');
    router.push(`/transformacion/tickets?${sp.toString()}`);
  }

  const { sorted, sortKey, sortDir, handleSort } = useSortableColumns(page.data);
  const isFirstPage = cursorsStack.length === 0 && !cursor;

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Tickets de Soporte</h1>
          <p className="mt-1 text-sm text-slate-500">
            {page.data.length} ticket{page.data.length !== 1 ? 's' : ''} en esta página
          </p>
        </div>
        <Link
          href="/transformacion/tickets/nuevo"
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota/90"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo ticket
        </Link>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-4 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API.
        </div>
      )}

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o descripción…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          <option value="abierto">Abierto</option>
          <option value="en_atencion">En atención</option>
          <option value="en_revision">En revisión</option>
          <option value="resuelto">Resuelto</option>
          <option value="cerrado">Cerrado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => updateParams({ priority: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Prioridad: Todas</option>
          <option value="P1">P1 — Crítica</option>
          <option value="P2">P2 — Alta</option>
          <option value="P3">P3 — Media</option>
          <option value="P4">P4 — Baja</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => updateParams({ category: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Categoría: Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.slaStatus}
          onChange={(e) => updateParams({ slaStatus: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">SLA: Todos</option>
          <option value="ok">En tiempo (&lt;75%)</option>
          <option value="warning">Por vencer (75–100%)</option>
          <option value="overdue">Vencido (&gt;100%)</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortableHeader label="ID" sortKey="displayId" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Solicitante" sortKey="requesterName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Categoría" sortKey="category" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Prioridad" sortKey="priority" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Estado" sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">SLA</th>
              <SortableHeader label="Fecha" sortKey="requestedAt" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              {isTd && <th className="px-4 py-3">Asignado a</th>}
              {isSuperAdmin && <th className="px-4 py-3">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={(isTd ? 8 : 7) + (isSuperAdmin ? 1 : 0)} className="px-4 py-10 text-center text-sm text-slate-400">
                  No se encontraron tickets con los filtros seleccionados.
                </td>
              </tr>
            )}
            {sorted.map((ticket) => {
              const sla = slaLight(ticket);
              const catIcon = CATEGORY_ICONS[ticket.category] ?? 'ti-help';
              return (
                <tr key={ticket.id} className="border-b border-slate-100 last:border-none hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/transformacion/tickets/${ticket.id}`}
                      className="font-mono text-xs font-semibold text-terracota hover:underline"
                    >
                      {ticket.displayId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">{ticket.requesterName}</p>
                    {ticket.requesterArea && (
                      <p className="text-xs text-slate-400">{ticket.requesterArea}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <i className={`ti ${catIcon} text-base leading-none`} />
                      <span className="capitalize">{ticket.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.priority ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-bold',
                          PRIORITY_STYLES[ticket.priority],
                        )}
                      >
                        {ticket.priority}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_STYLES[ticket.status],
                      )}
                    >
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sla ? (
                      <span
                        className={cn(
                          'inline-block h-3 w-3 rounded-full',
                          sla === 'verde' && 'bg-emerald-400',
                          sla === 'amarillo' && 'bg-amber-400',
                          sla === 'rojo' && 'bg-red-500',
                        )}
                        title={sla === 'verde' ? 'En tiempo' : sla === 'amarillo' ? 'Por vencer' : 'Vencido'}
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(ticket.requestedAt).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  {isTd && (
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {ticket.assigneeName ?? <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {isSuperAdmin && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => { setDeleteError(null); setDeleteTarget({ id: ticket.id, displayId: ticket.displayId }); }}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <span>Página {cursorsStack.length + 1}</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={isFirstPage}
              onClick={goPrev}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              disabled={!page.nextCursor}
              onClick={goNext}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-navy">¿Eliminar ticket?</h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Estás seguro de eliminar el ticket{' '}
              <strong>{deleteTarget.displayId}</strong>? Esta acción no se puede deshacer.
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const result = await deleteTicketAction(deleteTarget.id);
                  if (result.success) {
                    setDeleteTarget(null);
                    router.refresh();
                  } else {
                    setDeleteError(result.error ?? 'No se pudo eliminar el ticket.');
                  }
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
