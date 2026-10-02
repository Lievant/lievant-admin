'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  ErrorKind,
  HeadcountColumnInfo,
  HeadcountReport,
  HeadcountRow,
  HeadcountStatusFilter,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon, TableIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
const DEFAULT_COMPANY = 'LIEVANT';
const DEFAULT_COLUMNS = ['id', 'full_name', 'company', 'area', 'position'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const ESTADO_OPCIONES: { value: HeadcountStatusFilter; label: string }[] = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
  { value: 'todos', label: 'Todos' },
];

interface Filters {
  empresa: string[];
  activo: HeadcountStatusFilter;
  division: string;
  ubicacion: string;
  columns: string[];
}

// lib/api es server-only (usa next/headers), así que el query string se arma aquí.
function buildQuery(f: Filters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (f.empresa.length && !(f.empresa.length === 1 && f.empresa[0] === DEFAULT_COMPANY)) {
    q.set('empresa', f.empresa.join(','));
  }
  if (f.activo !== 'true') q.set('activo', f.activo);
  if (f.division) q.set('division', f.division);
  if (f.ubicacion) q.set('ubicacion', f.ubicacion);
  const isDefaultCols =
    f.columns.length === DEFAULT_COLUMNS.length && DEFAULT_COLUMNS.every((c) => f.columns.includes(c));
  if (f.columns.length && !isDefaultCols) q.set('columns', f.columns.join(','));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}

function formatCell(col: HeadcountColumnInfo, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (col.kind === 'date' && typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
  }
  if (col.kind === 'money' && typeof value === 'number') {
    return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
  return String(value);
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

interface Props {
  report: HeadcountReport | null;
  errorKind: ErrorKind | null;
}

export function HeadcountScreen({ report, errorKind }: Props) {
  const router = useRouter();

  const filters: Filters = {
    empresa: report?.filters.empresa ?? [DEFAULT_COMPANY],
    activo: report?.filters.activo ?? 'true',
    division: report?.filters.division ?? '',
    ubicacion: report?.filters.ubicacion ?? '',
    columns: report?.columns.map((c) => c.key) ?? DEFAULT_COLUMNS,
  };

  const [showColumns, setShowColumns] = useState(false);
  const [draftColumns, setDraftColumns] = useState<string[]>(filters.columns);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const columnsKey = filters.columns.join(',');
  useEffect(() => {
    setDraftColumns(columnsKey ? columnsKey.split(',') : DEFAULT_COLUMNS);
  }, [columnsKey]);

  // Al cambiar los datos (nuevo filtro) se regresa a la primera página.
  useEffect(() => {
    setPage(1);
  }, [report]);

  function navigate(overrides: Partial<Filters>) {
    const next = { ...filters, ...overrides };
    const qs = buildQuery(next);
    router.push(`/rrhh/reportes/headcount${qs ? `?${qs}` : ''}`);
  }

  function toggleCompany(code: string) {
    const set = new Set(filters.empresa);
    if (set.has(code)) set.delete(code);
    else set.add(code);
    // Sin empresa no hay reporte: se vuelve al default en lugar de dejarlo vacío.
    const empresa = set.size ? Array.from(set) : [DEFAULT_COMPANY];
    // División y ubicación dependen de la empresa; se limpian para no quedar huérfanas.
    navigate({ empresa, division: '', ubicacion: '' });
  }

  const sortedRows = useMemo(() => {
    const rows = report?.rows ?? [];
    if (!sort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const r = compare(a[sort.key], b[sort.key]);
      return sort.dir === 'asc' ? r : -r;
    });
    return copy;
  }, [report, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }

  async function exportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/employees/headcount?${buildQuery(filters, { format: 'xlsx' })}`);
      if (!res.ok) throw new Error(res.status === 403 ? 'Sin permiso para exportar' : `Error ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const fileName = match?.[1] ?? `headcount-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  }

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  const columns = report?.columns ?? [];
  const available = report?.availableColumns ?? [];
  const options = report?.options ?? { companies: [DEFAULT_COMPANY], divisions: [], locations: [] };

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH · Reportes</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-navy">Reporte de Headcount</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
              <LockIcon className="h-3 w-3" />
              Confidencial
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="text-lg font-bold text-navy">{report?.total ?? 0}</span> empleados con los
            filtros actuales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={!report || report.total === 0 || exporting}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            <TableIcon className="h-4 w-4" />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <Link
            href="/rrhh/reportes"
            className="shrink-0 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            ← Reportes
          </Link>
        </div>
      </header>

      {exportError && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {exportError}
        </div>
      )}

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API. Inicia sesión para ver datos en vivo.
        </div>
      )}

      {/* Filtros */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Empresa</p>
            <div className="flex flex-wrap gap-1.5">
              {options.companies.map((code) => {
                const active = filters.empresa.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleCompany(code)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      active
                        ? 'border-black bg-black text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
                    )}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            División / Área
            <select
              value={filters.division}
              onChange={(e) => navigate({ division: e.target.value })}
              className="min-w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-600 focus:border-black focus:outline-none"
            >
              <option value="">Todas</option>
              {options.divisions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ubicación
            <select
              value={filters.ubicacion}
              onChange={(e) => navigate({ ubicacion: e.target.value })}
              className="min-w-[160px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-600 focus:border-black focus:outline-none"
            >
              <option value="">Todas</option>
              {options.locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Estado
            <select
              value={filters.activo}
              onChange={(e) => navigate({ activo: e.target.value as HeadcountStatusFilter })}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-600 focus:border-black focus:outline-none"
            >
              {ESTADO_OPCIONES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Selector de columnas */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            aria-expanded={showColumns}
            className="flex items-center gap-1.5 text-sm font-semibold text-navy"
          >
            <ChevronDownIcon className={cn('h-4 w-4 transition', showColumns ? 'rotate-180' : '')} />
            Configurar columnas
            <span className="font-normal text-slate-400">({columns.length} seleccionadas)</span>
          </button>

          {showColumns && (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                {available.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={draftColumns.includes(c.key)}
                      onChange={(e) =>
                        setDraftColumns((cols) =>
                          e.target.checked ? [...cols, c.key] : cols.filter((k) => k !== c.key),
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 accent-black"
                    />
                    {c.label}
                    {c.sensitive && <span title="Columna sensible">🔒</span>}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ columns: draftColumns.length ? draftColumns : DEFAULT_COLUMNS })}
                  className="rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Aplicar selección
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftColumns(DEFAULT_COLUMNS);
                    navigate({ columns: DEFAULT_COLUMNS });
                  }}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
                >
                  Restablecer a columnas básicas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="flex items-center gap-1 uppercase hover:text-navy"
                    >
                      {c.label}
                      {c.sensitive && <span aria-hidden>🔒</span>}
                      {sort?.key === c.key && <span aria-hidden>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="px-4 py-12 text-center text-sm text-slate-400">
                    No hay empleados que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                pageRows.map((r: HeadcountRow) => (
                  <tr key={r.employeeId} className="hover:bg-slate-50">
                    {columns.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {c.key === 'full_name' ? (
                          <a
                            href={`/rrhh/empleados/${r.employeeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-navy hover:underline"
                          >
                            {formatCell(c, r[c.key])}
                          </a>
                        ) : (
                          formatCell(c, r[c.key])
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>

        {sortedRows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedRows.length)} de{' '}
              {sortedRows.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Página anterior"
                className="rounded-md border border-slate-200 p-1.5 hover:border-slate-300 disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Página siguiente"
                className="rounded-md border border-slate-200 p-1.5 hover:border-slate-300 disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
