'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { ClientListItem, ProjectsPage } from '@/lib/api';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortableColumns } from '@/hooks/use-sortable-columns';
import { cn } from '@/lib/utils';

const BUSINESS_UNITS = [
  { value: 'marketing_digital', label: 'Marketing Digital' },
  { value: 'marketplaces', label: 'Marketplaces' },
  { value: 'performance', label: 'Performance' },
  { value: 'fullcommerce', label: 'Fullcommerce' },
  { value: 'omnicanalidad', label: 'Omnicanalidad' },
];

const PROJECT_TYPE_LABELS: Record<string, string> = {
  recurring: 'Recurrente',
  one_time: 'One-time',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-amber-100 text-amber-800',
  closed: 'bg-slate-100 text-slate-600',
};

const TYPE_BADGE: Record<string, string> = {
  recurring: 'bg-blue-100 text-blue-700',
  one_time: 'bg-purple-100 text-purple-700',
};

const BU_LABEL: Record<string, string> = Object.fromEntries(
  BUSINESS_UNITS.map((u) => [u.value, u.label]),
);

interface Props {
  page: ProjectsPage;
  clients: ClientListItem[];
  apiUnavailable: boolean;
  filters: { status: string; projectType: string; businessUnit: string; search: string };
  cursor: string;
  activeCount: number | null;
}

function buildUrl(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const qs = u.toString();
  return `/finanzas/proyectos${qs ? `?${qs}` : ''}`;
}

export function ProjectsScreen({ page, clients, apiUnavailable, filters, activeCount }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const { sorted, sortKey, sortDir, handleSort } = useSortableColumns(page.data);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== filters.search) {
        router.push(buildUrl({ ...filters, search, cursor: undefined }));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  function changeFilter(key: string, value: string) {
    router.push(buildUrl({ ...filters, [key]: value, cursor: undefined }));
  }

  const clientNameById = Object.fromEntries(
    clients.map((c) => [c.id, c.primaryCompany.name]),
  );

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Finanzas</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Proyectos</h1>
          {activeCount !== null && (
            <p className="mt-1 text-sm text-slate-500">
              {activeCount} proyecto{activeCount !== 1 ? 's' : ''} activo{activeCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <Link
          href="/finanzas/proyectos/nuevo"
          className="flex items-center gap-2 rounded-lg bg-terracota px-4 py-2 text-sm font-medium text-white hover:bg-terracota/90"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo proyecto
        </Link>
      </div>

      {/* API banner */}
      {apiUnavailable && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La API no está disponible en este momento.
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto…"
            className="h-9 rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => changeFilter('status', e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filters.projectType}
          onChange={(e) => changeFilter('projectType', e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none"
        >
          <option value="">Tipo: Todos</option>
          {Object.entries(PROJECT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select
          value={filters.businessUnit}
          onChange={(e) => changeFilter('businessUnit', e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none"
        >
          <option value="">Área: Todas</option>
          {BUSINESS_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <SortableHeader label="ID" sortKey="displayId" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Nombre" sortKey="name" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Cliente" sortKey="clientName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Área" sortKey="primaryBusinessUnit" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Tipo" sortKey="projectType" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="PM" sortKey="projectManagerName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Estado" sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No se encontraron proyectos.
                </td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.displayId}</td>
                <td className="px-4 py-3 font-medium text-navy">{p.name}</td>
                <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                  {clientNameById[p.clientRecordId ?? ''] ?? p.clientName ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {BU_LABEL[p.primaryBusinessUnit ?? ''] ?? p.primaryBusinessUnit ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TYPE_BADGE[p.projectType] ?? 'bg-slate-100 text-slate-600')}>
                    {PROJECT_TYPE_LABELS[p.projectType] ?? p.projectType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.projectManagerEmail ? (
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar name={p.projectManagerName ?? ''} email={p.projectManagerEmail} />
                      <span className="truncate text-xs text-slate-600">{p.projectManagerName}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[p.status] ?? 'bg-slate-100 text-slate-600')}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/finanzas/proyectos/${p.id}`}
                    className="rounded-md px-3 py-1 text-xs font-medium text-terracota hover:bg-terracota/5"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {page.nextCursor && (
        <div className="mt-4 flex justify-end">
          <Link
            href={buildUrl({ ...filters, cursor: page.nextCursor })}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Siguiente →
          </Link>
        </div>
      )}
    </>
  );
}

function EmployeeAvatar({ name, email }: { name: string; email: string }) {
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="relative h-7 w-7 shrink-0">
      <img
        src={`/api/users/${encodeURIComponent(email)}/photo`}
        alt={name}
        className="h-7 w-7 rounded-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <div className="hidden h-7 w-7 items-center justify-center rounded-full bg-terracota text-[11px] font-semibold text-white">
        {initial}
      </div>
    </div>
  );
}
