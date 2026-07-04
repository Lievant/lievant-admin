'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon, SearchIcon } from '@/components/icons';
import { SortableHeader } from '@/components/ui/sortable-header';
import { useSortableColumns } from '@/hooks/use-sortable-columns';
import { useCurrentUser } from '@/components/user-provider';
import type { CatalogItem, LicenseEmployeeRow, LicenseStats, ToolCatalogItem } from '@/lib/api';
import { NewToolDialog } from './new-tool-dialog';

interface Filters {
  search: string;
  tool: string;
  hasAccess: string;
  department: string;
  division: string;
}

interface Catalogs {
  areas: CatalogItem[];
  divisions: CatalogItem[];
}

interface LicensesScreenProps {
  employees: LicenseEmployeeRow[];
  stats: LicenseStats;
  tools: ToolCatalogItem[];
  apiUnavailable: boolean;
  filters: Filters;
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

function EmployeeAvatar({ name, email }: { name: string; email: string | null }) {
  const [imgSrc, setImgSrc] = useState<string | null>(
    email ? `/api/users/${encodeURIComponent(email)}/photo` : null,
  );

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
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy">{name}</p>
        {email && <p className="truncate text-xs text-slate-400">{email}</p>}
      </div>
    </div>
  );
}

function ToolBadge({ hasAccess, isAdmin }: { hasAccess: boolean; isAdmin: boolean }) {
  if (!hasAccess) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        ✕
      </span>
    );
  }
  if (isAdmin) {
    return (
      <span
        title="Admin / superadmin"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700"
      >
        👑
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
      ✓
    </span>
  );
}

export function LicensesScreen({ employees, stats, tools, apiUnavailable, filters, catalogs }: LicensesScreenProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.roles?.some((r) => r.name === 'SUPER_ADMIN') ?? false;
  const [search, setSearch] = useState(filters.search);
  const [showNewToolDialog, setShowNewToolDialog] = useState(false);

  useEffect(() => setSearch(filters.search), [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (search !== filters.search) updateParams({ search: search || null });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function updateParams(overrides: Record<string, string | null>) {
    const sp = new URLSearchParams();
    if (filters.search) sp.set('search', filters.search);
    if (filters.tool) sp.set('tool', filters.tool);
    if (filters.hasAccess) sp.set('hasAccess', filters.hasAccess);
    if (filters.department) sp.set('department', filters.department);
    if (filters.division) sp.set('division', filters.division);

    Object.entries(overrides).forEach(([k, v]) => {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    });

    const qs = sp.toString();
    router.push(`/transformacion/licenciamientos${qs ? `?${qs}` : ''}`);
  }

  const { sorted, sortKey, sortDir, handleSort } = useSortableColumns(employees);
  const hasFilters = Boolean(filters.search || filters.tool || filters.hasAccess || filters.department || filters.division);

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Maestro de Licenciamientos</h1>
          <p className="mt-1 text-sm text-slate-500">
            {stats.totalEmployeesWithLicenses} empleado{stats.totalEmployeesWithLicenses !== 1 ? 's' : ''} con licencias registradas
          </p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setShowNewToolDialog(true)}
            className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva herramienta
          </button>
        )}
      </header>

      {showNewToolDialog && <NewToolDialog onClose={() => setShowNewToolDialog(false)} />}

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Con licencias" value={stats.totalEmployeesWithLicenses} accent="text-terracota" />
        {stats.byTool.map((t) => (
          <StatCard key={t.toolId} label={t.toolName} value={t.count} />
        ))}
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.tool}
          onChange={(e) => updateParams({ tool: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Herramienta: Todas</option>
          {tools.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={filters.hasAccess}
          onChange={(e) => updateParams({ hasAccess: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Acceso: Todos</option>
          <option value="true">Con acceso</option>
          <option value="false">Sin acceso</option>
        </select>

        <select
          value={filters.department}
          onChange={(e) => updateParams({ department: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Área: Todas</option>
          {catalogs.areas.map((a) => (
            <option key={a.id} value={a.name}>{a.name}</option>
          ))}
        </select>

        <select
          value={filters.division}
          onChange={(e) => updateParams({ division: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">División: Todas</option>
          {catalogs.divisions.map((d) => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.push('/transformacion/licenciamientos')}
            className="text-sm font-medium text-terracota hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SortableHeader label="Empleado" sortKey="fullName" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Área / División" sortKey="area" currentSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">AD Name</th>
              <th className="px-4 py-3">Responsiva</th>
              {tools.map((t) => (
                <th key={t.id} className="px-3 py-3 text-center">{t.name}</th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5 + tools.length} className="px-4 py-12 text-center text-sm text-slate-400">
                  No se encontraron empleados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              sorted.map((emp) => (
                <tr key={emp.employeeId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <EmployeeAvatar name={emp.fullName} email={emp.corporateEmail} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[emp.area, emp.division].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.activeDirectoryName ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.responsiva ?? '—'}</td>
                  {tools.map((t) => {
                    const assignment = emp.tools.find((et) => et.toolId === t.id);
                    return (
                      <td key={t.id} className="px-3 py-3 text-center">
                        <ToolBadge hasAccess={assignment?.hasAccess ?? false} isAdmin={assignment?.isAdmin ?? false} />
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <Link
                      href={`/transformacion/licenciamientos/${emp.employeeId}`}
                      className="text-xs font-medium text-terracota hover:underline"
                    >
                      Editar licencias
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
