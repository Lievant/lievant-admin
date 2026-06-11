'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ClientsPage, UserSummary } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon, SearchIcon } from '@/components/icons';
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_BADGE_STYLES,
  CLIENT_STATUS_LABELS,
  clientDisplayName,
  clientTypeLabel,
} from './constants';

interface ClientsFilters {
  status: string;
  accountManagerId: string;
  industry: string;
  search: string;
}

interface ClientsScreenProps {
  page: ClientsPage;
  accountManagers: UserSummary[];
  apiUnavailable: boolean;
  filters: ClientsFilters;
  cursor: string;
  cursorsStack: string[];
}

export function ClientsScreen({
  page,
  accountManagers,
  apiUnavailable,
  filters,
  cursor,
  cursorsStack,
}: ClientsScreenProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [industry, setIndustry] = useState(filters.industry);

  useEffect(() => {
    setSearch(filters.search);
    setIndustry(filters.industry);
  }, [filters.search, filters.industry]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== filters.search || industry !== filters.industry) {
        updateParams({ search: search || null, industry: industry || null });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, industry]);

  function buildParams(overrides: Record<string, string | null>, keepPagination: boolean) {
    const sp = new URLSearchParams();
    if (filters.status) sp.set('status', filters.status);
    if (filters.accountManagerId) sp.set('accountManagerId', filters.accountManagerId);
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

  const hasFilters = Boolean(filters.status || filters.accountManagerId || filters.industry || filters.search);
  const isFirstPage = cursorsStack.length === 0 && !cursor;

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">
            {page.data.length} cliente{page.data.length === 1 ? '' : 's'} en esta página
          </p>
        </div>
        <Link
          href="/finanzas/clientes/nuevo"
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo cliente
        </Link>
      </header>

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
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
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          {CLIENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CLIENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={filters.accountManagerId}
          onChange={(e) => updateParams({ accountManagerId: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">AM: Todos</option>
          {accountManagers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industria"
          className="w-40 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 placeholder:text-slate-400 focus:border-terracota focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Cliente / Grupo</th>
              <th className="px-4 py-3">Empresas</th>
              <th className="px-4 py-3">Marcas</th>
              <th className="px-4 py-3">AM asignado</th>
              <th className="px-4 py-3">Industria</th>
              <th className="px-4 py-3">Ciudad / País</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Documentos</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {page.data.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">
                  {hasFilters
                    ? 'No se encontraron clientes con los filtros seleccionados.'
                    : 'Aún no hay clientes registrados.'}
                </td>
              </tr>
            )}
            {page.data.map((client) => {
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
                  <td className="px-4 py-3 text-slate-600">{client.accountManager?.name ?? '—'}</td>
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
                    {client.missingDocumentsCount > 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-600">
                        {client.missingDocumentsCount} faltante{client.missingDocumentsCount === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                        Completo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/finanzas/clientes/${client.id}`}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pager */}
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
      </div>
    </div>
  );
}
