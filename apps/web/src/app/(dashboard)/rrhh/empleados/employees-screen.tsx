'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { EmployeesPage } from '@/lib/api';
import { avatarColor, initials } from '@/lib/avatar';
import { PlusIcon, SearchIcon } from '@/components/icons';
import type { EmployeeFilterCatalogs } from './catalog-data';
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_BADGE_STYLES,
  EMPLOYEE_STATUS_LABELS,
  MODALITY_BADGE_STYLES,
  MODALITY_LABELS,
  calculateSeniority,
  companyBadgeStyle,
  isContractExpiringSoon,
} from './constants';

interface EmployeesFilters {
  status: string;
  companyCode: string;
  division: string;
  location: string;
  search: string;
}

interface EmployeesScreenProps {
  page: EmployeesPage;
  apiUnavailable: boolean;
  filters: EmployeesFilters;
  cursor: string;
  cursorsStack: string[];
  catalogs: EmployeeFilterCatalogs;
}

export function EmployeesScreen({ page, apiUnavailable, filters, cursor, cursorsStack, catalogs }: EmployeesScreenProps) {
  const router = useRouter();
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
    if (filters.companyCode) sp.set('companyCode', filters.companyCode);
    if (filters.division) sp.set('division', filters.division);
    if (filters.location) sp.set('location', filters.location);
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
    router.push(`/rrhh/empleados${qs ? `?${qs}` : ''}`);
  }

  function goNext() {
    if (!page.nextCursor) return;
    const sp = buildParams({}, true);
    sp.set('cursors', [...cursorsStack, cursor].join(','));
    sp.set('cursor', page.nextCursor);
    router.push(`/rrhh/empleados?${sp.toString()}`);
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
    router.push(`/rrhh/empleados?${sp.toString()}`);
  }

  const hasFilters = Boolean(filters.status || filters.companyCode || filters.division || filters.location || filters.search);
  const isFirstPage = cursorsStack.length === 0 && !cursor;

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Empleados</h1>
          <p className="mt-1 text-sm text-slate-500">
            {page.data.length} colaborador{page.data.length === 1 ? '' : 'es'} en esta página
          </p>
        </div>
        <Link
          href="/rrhh/empleados/nuevo"
          className="flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo empleado
        </Link>
      </header>

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión como administrador para ver datos en vivo.
        </div>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Colaboradores" value={page.stats.total} />
        <StatCard label="Activos" value={page.stats.active} accent="text-green-600" />
        <StatCard label="Baja" value={page.stats.inactive} accent="text-slate-500" />
        <StatCard label="Empresas" value={page.stats.companies} />
        <StatCard label="Contratos por vencer" value={page.stats.expiringContracts} accent="text-amber-600" />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o ID…"
            className="w-full text-sm text-navy placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.companyCode}
          onChange={(e) => updateParams({ companyCode: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Empresa: Todas</option>
          {catalogs.companies.map((company) => (
            <option key={company.id} value={company.code ?? ''}>
              {company.name}
            </option>
          ))}
        </select>

        <select
          value={filters.division}
          onChange={(e) => updateParams({ division: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">División: Todas</option>
          {catalogs.divisions.map((division) => (
            <option key={division.id} value={division.name}>
              {division.name}
            </option>
          ))}
        </select>

        <select
          value={filters.location}
          onChange={(e) => updateParams({ location: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Ubicación: Todas</option>
          {catalogs.locations.map((location) => (
            <option key={location.id} value={location.name}>
              {location.name}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:border-terracota focus:outline-none"
        >
          <option value="">Estado: Todos</option>
          {EMPLOYEE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {EMPLOYEE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Empleado</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">División / Área</th>
              <th className="px-4 py-3">Puesto</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Modalidad</th>
              <th className="px-4 py-3">Antigüedad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {page.data.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">
                  {hasFilters
                    ? 'No se encontraron empleados con los filtros seleccionados.'
                    : 'Aún no hay empleados registrados.'}
                </td>
              </tr>
            )}
            {page.data.map((employee) => {
              const expiringSoon = isContractExpiringSoon(employee.contractEndDate);

              return (
                <tr key={employee.id} className="border-b border-slate-100 last:border-none">
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                      {employee.displayId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: avatarColor(employee.fullName) }}
                      >
                        {initials(employee.fullName)}
                      </div>
                      <div>
                        <p className="font-medium text-navy">{employee.fullName}</p>
                        <p className="text-xs text-slate-400">{employee.corporateEmail ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        companyBadgeStyle(employee.companyName),
                      )}
                    >
                      {employee.companyName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[employee.division, employee.area].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{employee.position}</td>
                  <td className="px-4 py-3 text-slate-600">{employee.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    {employee.modality ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-1 text-xs font-semibold',
                          MODALITY_BADGE_STYLES[employee.modality],
                        )}
                      >
                        {MODALITY_LABELS[employee.modality]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-2">
                      {calculateSeniority(employee.seniorityDate)}
                      {expiringSoon && (
                        <span
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600"
                          title="El contrato vence en menos de 30 días"
                        >
                          Contrato por vencer
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        EMPLOYEE_STATUS_BADGE_STYLES[employee.status],
                      )}
                    >
                      {EMPLOYEE_STATUS_LABELS[employee.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rrhh/empleados/${employee.id}`}
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold text-navy', accent)}>{value}</p>
    </div>
  );
}
