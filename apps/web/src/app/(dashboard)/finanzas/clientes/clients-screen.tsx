'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CatalogItem, ClientsPage, DocStatus, ErrorKind } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { deleteClientAction } from './actions';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortableColumns } from '@/hooks/use-sortable-columns';
import { useCurrentUser } from '@/components/user-provider';
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_BADGE_STYLES,
  CLIENT_STATUS_LABELS,
  clientDisplayName,
  clientTypeLabel,
} from './constants';

interface ClientsFilters {
  status: string;
  docStatus: string;
  industry: string;
  search: string;
}

interface ClientsScreenProps {
  page: ClientsPage;
  industries: CatalogItem[];
  errorKind: ErrorKind | null;
  filters: ClientsFilters;
  cursor: string;
  cursorsStack: string[];
}

const DOC_STATUS_OPTIONS: { value: DocStatus | ''; label: string }[] = [
  { value: '', label: 'Documentos: Todos' },
  { value: 'incomplete', label: 'Incompletos' },
  { value: 'complete', label: 'Completos' },
  { value: 'no_required', label: 'Sin requeridos' },
];

export function ClientsScreen({
  page,
  industries,
  errorKind,
  filters,
  cursor,
  cursorsStack,
}: ClientsScreenProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState(filters.search);

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== filters.search) {
        updateParams({ search: search || null });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function buildParams(overrides: Record<string, string | null>, keepPagination: boolean) {
    const sp = new URLSearchParams();
    if (filters.status) sp.set('status', filters.status);
    if (filters.docStatus) sp.set('docStatus', filters.docStatus);
    if (filters.industry) sp.set('industry', filters.industry);
    if (filters.search) sp.set('search', filters.search);
    if (keepPagination) {
      if (cursor) sp.set('cursor', cursor);
      if (cursorsStack.length) sp.set('cursors', cursorsStack.join(','));
    }
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === null || value === '') sp.delete(key);
      else sp.set(key, value);
    });
    return sp;
  }

  function updateParams(overrides: Record<string, string | null>) {
    const sp = buildParams(overrides, false);
    const qs = sp.toString();
    router.push(`/finanzas/clientes${qs ? `?${qs}` : ''}`);
  }

  function goNext() {
    if (!page.nextCursor) return;
    const sp = buildParams({}, true);
    sp.set('cursors', [...cursorsStack, cursor].join(','));
    sp.set('cursor', page.nextCursor);
    router.push(`/finanzas/clientes?${sp.toString()}`);
  }

  function goPrev() {
    if (cursorsStack.length === 0) return;
    const stack = [...cursorsStack];
    const prev = stack.pop() ?? '';
    const sp = buildParams({}, true);
    if (prev) sp.set('cursor', prev);
    else sp.delete('cursor');
    if (stack.length) sp.set('cursors', stack.join(','));
    else sp.delete('cursors');
    router.push(`/finanzas/clientes?${sp.toString()}`);
  }

  const { sorted, sortKey, sortDir, handleSort } = useSortableColumns(page.data);
  const hasFilters = Boolean(filters.status || filters.docStatus || filters.industry || filters.search);
  const isFirstPage = cursorsStack.length === 0 && !cursor;
  const hasPagination = !filters.docStatus;

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {page.data.length} cliente{page.data.length === 1 ? '' : 's'}{hasPagination ? ' en esta página' : ''}
          </p>
        </div>
        <Link
          href="/finanzas/clientes/nuevo"
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo cliente
        </Link>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API. Inicia sesión como administrador para ver datos en vivo.
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RFC o ID…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-black focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          {CLIENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CLIENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={filters.docStatus}
          onChange={(e) => updateParams({ docStatus: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-black focus:outline-none"
        >
          {DOC_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filters.industry}
          onChange={(e) => updateParams({ industry: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-black focus:outline-none"
        >
          <option value="">Industria: Todas</option>
          {industries.map((ind) => (
            <option key={ind.id} value={ind.name}>
              {ind.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortableHeader label="ID" sortKey="displayId" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Cliente / Grupo</th>
              <th className="px-4 py-3">Empresas</th>
              <th className="px-4 py-3">Marcas</th>
              <th className="px-4 py-3">Industria</th>
              <th className="px-4 py-3">Ciudad / País</th>
              <SortableHeader label="Estado" sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Documentos" sortKey="docStatus" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {page.data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">
                  {hasFilters
                    ? 'No se encontraron clientes con los filtros seleccionados.'
                    : 'Aún no hay clientes registrados.'}
                </td>
              </tr>
            )}
            {sorted.map((client) => {
              const name = clientDisplayName(client);

              return (
                <tr key={client.id} className="border-b border-slate-100 last:border-none">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                      {client.displayId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: avatarColor(name) }}
                      >
                        {initials(name)}
                      </div>
                      <div>
                        <p className="font-medium text-navy">{name}</p>
                        <p className="text-xs text-slate-400">{clientTypeLabel(client)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{client.companiesCount}</td>
                  <td className="px-4 py-3 text-slate-600">{client.brandsCount}</td>
                  <td className="px-4 py-3 text-slate-600">{client.primaryCompany.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {client.city || client.country ? (
                      <>
                        {client.city ?? '—'}
                        {client.city && client.country ? ', ' : ''}
                        {client.country ?? ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        CLIENT_STATUS_BADGE_STYLES[client.status],
                      )}
                    >
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {client.docStatus === 'complete' && (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                        Completo
                      </span>
                    )}
                    {client.docStatus === 'incomplete' && (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                        Incompleto
                      </span>
                    )}
                    {client.docStatus === 'no_required' && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                        Sin requeridos
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/finanzas/clientes/${client.id}`}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                      >
                        Ver detalle
                      </Link>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => { setDeleteError(null); setDeleteTarget({ id: client.id, name: clientDisplayName(client) }); }}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </ScrollableTable>

        {/* Pager — hidden when docStatus filter is active (all results returned) */}
        {hasPagination && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
            <span>Página {cursorsStack.length + 1}</span>
            <div className="flex items-center gap-1">
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
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-navy">¿Eliminar cliente?</h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Estás seguro de eliminar a <strong>{deleteTarget.name}</strong>? Esta acción no se puede deshacer fácilmente.
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
                  const result = await deleteClientAction(deleteTarget.id);
                  if (result.success) {
                    setDeleteTarget(null);
                    router.refresh();
                  } else {
                    setDeleteError(result.error ?? 'No se pudo eliminar el cliente.');
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
