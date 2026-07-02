'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CatalogItem, Vendor } from '@/lib/api';
import { deleteVendorAction } from './actions';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { VENDOR_STATUSES, VENDOR_STATUS_BADGE_STYLES, VENDOR_STATUS_LABELS, vendorDisplayName } from './constants';
import { useCurrentUser } from '@/components/user-provider';

interface VendorsFilters {
  status: string;
  category_id: string;
  search: string;
}

interface VendorsScreenProps {
  vendors: Vendor[];
  categories: CatalogItem[];
  apiUnavailable: boolean;
  filters: VendorsFilters;
}

export function VendorsScreen({ vendors, categories, apiUnavailable, filters }: VendorsScreenProps) {
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

  function updateParams(overrides: Record<string, string | null>) {
    const sp = new URLSearchParams();
    if (filters.status) sp.set('status', filters.status);
    if (filters.category_id) sp.set('category_id', filters.category_id);
    if (filters.search) sp.set('search', filters.search);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === null || value === '') sp.delete(key);
      else sp.set(key, value);
    });
    const qs = sp.toString();
    router.push(`/finanzas/proveedores${qs ? `?${qs}` : ''}`);
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const hasFilters = Boolean(filters.status || filters.category_id || filters.search);

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Proveedores</h1>
          <p className="mt-1 text-sm text-slate-500">Finanzas · Directorio de proveedores</p>
        </div>
        <Link
          href="/finanzas/proveedores/nuevo"
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo proveedor
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
            placeholder="Buscar por nombre, RFC o nombre comercial…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.category_id}
          onChange={(e) => updateParams({ category_id: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Categoría: Todas</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Status: Todos</option>
          {VENDOR_STATUSES.map((status) => (
            <option key={status} value={status}>
              {VENDOR_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre comercial</th>
              <th className="px-4 py-3">RFC</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Días crédito</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  {hasFilters
                    ? 'No se encontraron proveedores con los filtros seleccionados.'
                    : 'Aún no hay proveedores registrados.'}
                </td>
              </tr>
            )}
            {vendors.map((vendor) => {
              const name = vendorDisplayName(vendor);

              return (
                <tr
                  key={vendor.id}
                  onClick={() => router.push(`/finanzas/proveedores/${vendor.id}`)}
                  className="cursor-pointer border-b border-slate-100 last:border-none hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: avatarColor(name) }}
                      >
                        {initials(name)}
                      </div>
                      <p className="font-medium text-navy">{name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{vendor.rfc}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {vendor.categoryId ? categoryMap.get(vendor.categoryId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        VENDOR_STATUS_BADGE_STYLES[vendor.status],
                      )}
                    >
                      {VENDOR_STATUS_LABELS[vendor.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {vendor.paymentTermsDays != null ? `${vendor.paymentTermsDays} días` : '—'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/finanzas/proveedores/${vendor.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                      >
                        Ver detalle
                      </Link>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget({ id: vendor.id, name: vendorDisplayName(vendor) }); }}
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
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-navy">¿Eliminar proveedor?</h3>
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
                  const result = await deleteVendorAction(deleteTarget.id);
                  if (result.success) {
                    setDeleteTarget(null);
                    router.refresh();
                  } else {
                    setDeleteError(result.error ?? 'No se pudo eliminar el proveedor.');
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
