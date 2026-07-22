'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortableColumns } from '@/hooks/use-sortable-columns';
import type { EquipmentBrandCatalog, EquipmentPage, EquipmentStats, EquipmentStatusCatalog, EquipmentTypeCatalog, ErrorKind } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { statusBadgeStyle, typeIcon } from './constants';

interface Filters {
  search: string;
  equipmentType: string;
  brand: string;
  status: string;
  location: string;
  area: string;
}

interface Catalogs {
  types: EquipmentTypeCatalog[];
  brands: EquipmentBrandCatalog[];
  statuses: EquipmentStatusCatalog[];
}

interface InventoryScreenProps {
  page: EquipmentPage;
  stats: EquipmentStats;
  errorKind: ErrorKind | null;
  filters: Filters;
  cursor: string;
  cursorsStack: string[];
  catalogs: Catalogs;
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? 'text-navy'}`}>{value}</p>
    </div>
  );
}

function EmployeeAvatar({ name, email }: { name: string | null; email: string | null }) {
  const [imgSrc, setImgSrc] = useState<string | null>(
    email ? `/api/users/${encodeURIComponent(email)}/photo` : null,
  );

  if (!name) return <span className="text-slate-400">—</span>;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: avatarColor(name) }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={name}
            className="h-full w-full rounded-full object-cover"
            onError={() => setImgSrc(null)}
          />
        ) : (
          initials(name)
        )}
      </div>
      <span className="max-w-[140px] truncate text-navy">{name}</span>
    </div>
  );
}

export function InventoryScreen({
  page,
  stats,
  errorKind,
  filters,
  cursor,
  cursorsStack,
  catalogs,
}: InventoryScreenProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);

  useEffect(() => { setSearch(filters.search); }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== filters.search) updateParams({ search: search || null });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function buildParams(overrides: Record<string, string | null>, keepPagination: boolean) {
    const sp = new URLSearchParams();
    if (filters.search) sp.set('search', filters.search);
    if (filters.equipmentType) sp.set('equipmentType', filters.equipmentType);
    if (filters.brand) sp.set('brand', filters.brand);
    if (filters.status) sp.set('status', filters.status);
    if (filters.location) sp.set('location', filters.location);
    if (filters.area) sp.set('area', filters.area);
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
    router.push(`/transformacion/inventario${qs ? `?${qs}` : ''}`);
  }

  function goNext() {
    if (!page.nextCursor) return;
    const sp = buildParams({}, true);
    sp.set('cursors', [...cursorsStack, cursor].join(','));
    sp.set('cursor', page.nextCursor);
    router.push(`/transformacion/inventario?${sp.toString()}`);
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
    router.push(`/transformacion/inventario?${sp.toString()}`);
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
          <h1 className="text-2xl font-bold text-navy">Inventario Tecnológico</h1>
          <p className="mt-1 text-sm text-slate-500">
            {stats.total} equipo{stats.total !== 1 ? 's' : ''} registrados · {stats.assigned} asignados ({stats.assignedPercent}%)
          </p>
        </div>
        <Link
          href="/transformacion/inventario/nuevo"
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo equipo
        </Link>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total equipos" value={stats.total} />
        <StatCard label="Asignados" value={stats.assigned} accent="text-blue-600" />
        <StatCard label="Disponibles" value={stats.available} accent="text-green-600" />
        <StatCard label="% Asignado" value={stats.assignedPercent} accent="text-terracota" />
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID, modelo, serie o colaborador…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.equipmentType}
          onChange={(e) => updateParams({ equipmentType: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Tipo: Todos</option>
          {catalogs.types.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>

        <select
          value={filters.brand}
          onChange={(e) => updateParams({ brand: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Marca: Todas</option>
          {catalogs.brands.map((b) => (
            <option key={b.id} value={b.name}>{b.name}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Estatus: Todos</option>
          {catalogs.statuses.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>

        <select
          value={filters.location}
          onChange={(e) => updateParams({ location: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Ubicación: Todas</option>
          {['León', 'Ciudad de México', 'Guadalajara', 'Medellín', 'Charlotte'].map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortableHeader label="ID" sortKey="displayId" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">ID Legado</th>
              <SortableHeader label="Tipo" sortKey="equipmentType" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Marca / Modelo" sortKey="brand" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Asignado a</th>
              <SortableHeader label="Área" sortKey="area" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Ubicación" sortKey="location" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Estatus" sortKey="status" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  No se encontraron equipos con los filtros aplicados.
                </td>
              </tr>
            ) : (
              sorted.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/transformacion/inventario/${item.id}`}
                      className="font-mono text-xs font-semibold text-terracota hover:underline"
                    >
                      {item.displayId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.legacyId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <i className={`ti ${typeIcon(item.equipmentType)} text-slate-400`} />
                      <span className="text-slate-700">{item.equipmentType}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-navy">{item.brand ?? ''}</span>
                    {item.model && <span className="ml-1 text-slate-500">{item.model}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <EmployeeAvatar name={item.assignedEmployeeName} email={item.assignedEmployeeEmail} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.area ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyle(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/transformacion/inventario/${item.id}`}
                      className="text-xs font-medium text-terracota hover:underline"
                    >
                      Ver
                    </Link>
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
        <span>{page.data.length > 0 ? `${page.data.length} de ${page.total + (page.nextCursor ? '+' : '')} registros` : ''}</span>
        <div className="flex gap-2">
          {!isFirstPage && (
            <button
              onClick={goPrev}
              className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm hover:bg-slate-50"
            >
              ← Anterior
            </button>
          )}
          {page.nextCursor && (
            <button
              onClick={goNext}
              className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-sm hover:bg-slate-50"
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
