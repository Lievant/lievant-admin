'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import type {
  DocumentActivityPage,
  DocumentActivityRow,
  DocumentEntityFilter,
  DocumentEntityKey,
  DocumentEntityPage,
  DocumentEntityRow,
  DocumentStatusFilter,
  DocumentSummary,
  DocumentSummaryBlock,
  ErrorKind,
} from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { SearchIcon, TableIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface TabConfig {
  key: DocumentEntityKey;
  label: string;
  summaryKey: keyof DocumentSummary;
  detailHref: (id: string) => string;
}

const TABS: TabConfig[] = [
  {
    key: 'employees',
    label: 'Empleados',
    summaryKey: 'empleados',
    detailHref: (id) => `/rrhh/empleados/${id}`,
  },
  {
    key: 'clients',
    label: 'Clientes',
    summaryKey: 'clientes',
    detailHref: (id) => `/finanzas/clientes/${id}`,
  },
  {
    key: 'vendors',
    label: 'Proveedores',
    summaryKey: 'proveedores',
    detailHref: (id) => `/finanzas/proveedores/${id}`,
  },
];

const FILTER_OPCIONES: { value: DocumentEntityFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'complete', label: 'Completos' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'sin_docs', label: 'Sin documentos' },
  { value: 'no_required', label: 'Sin requeridos' },
];

const STATUS_OPCIONES: { value: DocumentStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Solo activos' },
  { value: 'inactive', label: 'Solo inactivos' },
];

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_ROWS = 2000;

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** Los proveedores usan 'activo'/'inactivo'; empleados y clientes 'active'/'inactive'. */
function statusLabel(status: string): string {
  if (status === 'active' || status === 'activo') return 'Activo';
  if (status === 'inactive' || status === 'inactivo') return 'Inactivo';
  return status || '—';
}

function bucketOf(row: DocumentEntityRow): 'complete' | 'en_proceso' | 'sin_docs' | 'no_required' {
  if (row.docStatus === 'complete') return 'complete';
  if (row.docStatus === 'no_required') return 'no_required';
  return row.totalDocs > 0 ? 'en_proceso' : 'sin_docs';
}

const BUCKET_STYLES: Record<string, { label: string; badge: string; dot: string }> = {
  complete: {
    label: 'Completo',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  en_proceso: {
    label: 'En proceso',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
  },
  sin_docs: {
    label: 'Sin documentos',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    dot: 'bg-red-500',
  },
  no_required: {
    label: 'Sin requeridos',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
  },
};

function DocStatusBadge({ row }: { row: DocumentEntityRow }) {
  const style = BUCKET_STYLES[bucketOf(row)]!;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        style.badge,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

function SummaryCard({ title, block }: { title: string; block: DocumentSummaryBlock }) {
  const filas = [
    { key: 'complete', valor: block.completos },
    { key: 'en_proceso', valor: block.enProceso },
    { key: 'sin_docs', valor: block.sinDocumentos },
    { key: 'no_required', valor: block.sinRequeridos },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
        <p className="mt-1 text-sm text-slate-500">
          <span className="text-2xl font-bold text-navy">{block.total}</span>
          <span className="ml-2">
            {block.activos} activos · {block.inactivos} inactivos
          </span>
        </p>
      </div>
      <dl className="divide-y divide-slate-100">
        {filas.map(({ key, valor }) => {
          const style = BUCKET_STYLES[key]!;
          return (
            <div key={key} className="flex items-center justify-between px-5 py-2.5">
              <dt className="flex items-center gap-2 text-sm text-slate-600">
                <span className={cn('h-2 w-2 rounded-full', style.dot)} />
                {style.label}
              </dt>
              <dd className="text-sm font-semibold text-navy">{valor}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function EntityList({ tab }: { tab: TabConfig }) {
  const [data, setData] = useState<DocumentEntityPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<DocumentEntityFilter>('all');
  const [status, setStatus] = useState<DocumentStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [searchAplicada, setSearchAplicada] = useState('');
  const [page, setPage] = useState(1);

  // La búsqueda se aplica con un respiro para no pegarle al API en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchAplicada(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(false);

    const q = new URLSearchParams({ entity: tab.key, page: String(page), limit: String(PAGE_SIZE) });
    if (filter !== 'all') q.set('filter', filter);
    if (status !== 'all') q.set('status', status);
    if (searchAplicada.trim()) q.set('search', searchAplicada.trim());

    fetch(`/api/reports/documents/entities?${q.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<DocumentEntityPage>;
      })
      .then((json) => {
        if (!cancelado) setData(json);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [tab.key, page, filter, status, searchAplicada]);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as DocumentEntityFilter);
            setPage(1);
          }}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
        >
          {FILTER_OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as DocumentStatusFilter);
            setPage(1);
          }}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
        >
          {STATUS_OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-navy focus:border-black focus:outline-none"
          />
        </div>

        {data && (
          <p className="text-sm text-slate-500">
            {data.total} {data.total === 1 ? 'registro' : 'registros'}
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          No se pudo cargar la lista.
        </p>
      ) : loading && !data ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Sin resultados con estos filtros.
        </p>
      ) : (
        <ScrollableTable>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Subidos</th>
                <th className="px-3 py-2 text-right">Requeridos</th>
                <th className="px-3 py-2 text-right">Faltan</th>
                <th className="px-3 py-2">Último doc</th>
                <th className="px-3 py-2">Documentación</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-navy">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{statusLabel(row.status)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{row.totalDocs}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{row.requiredDocs}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums font-semibold',
                      row.missingDocs > 0 ? 'text-red-600' : 'text-slate-400',
                    )}
                  >
                    {row.missingDocs}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{formatDate(row.lastDocUploadedAt)}</td>
                  <td className="px-3 py-2">
                    <DocStatusBadge row={row} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={tab.detailHref(row.id)}
                      className="text-sm font-medium text-black hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Página {data.page} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPaginas || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ActivityLog({ tab }: { tab: TabConfig }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<DocumentActivityPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [exportando, setExportando] = useState(false);

  // El rango por defecto son los últimos 7 días. Se calcula después del montaje
  // para que el HTML del servidor y el del cliente no discrepen.
  useEffect(() => {
    const hoy = new Date();
    const hace7 = new Date();
    hace7.setDate(hoy.getDate() - 6);
    setDateFrom(isoDay(hace7));
    setDateTo(isoDay(hoy));
  }, []);

  const aplicarRango = useCallback((desde: Date, hasta: Date) => {
    setDateFrom(isoDay(desde));
    setDateTo(isoDay(hasta));
    setPage(1);
  }, []);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    let cancelado = false;
    setLoading(true);
    setError(null);

    const q = new URLSearchParams({
      entity: tab.key,
      dateFrom,
      dateTo,
      page: String(page),
      limit: String(PAGE_SIZE),
    });

    fetch(`/api/reports/documents/activity?${q.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<DocumentActivityPage>;
      })
      .then((json) => {
        if (!cancelado) setData(json);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el log de actividad.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [tab.key, dateFrom, dateTo, page]);

  async function exportar() {
    if (!dateFrom || !dateTo) return;
    setExportando(true);
    setError(null);
    try {
      const filas: DocumentActivityRow[] = [];
      let pagina = 1;
      let total = Infinity;

      while (filas.length < total && filas.length < EXPORT_MAX_ROWS) {
        const q = new URLSearchParams({
          entity: tab.key,
          dateFrom,
          dateTo,
          page: String(pagina),
          limit: String(EXPORT_PAGE_SIZE),
        });
        const res = await fetch(`/api/reports/documents/activity?${q.toString()}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as DocumentActivityPage;
        total = json.total;
        filas.push(...json.items);
        if (json.items.length === 0) break;
        pagina += 1;
      }

      const hoja = filas.map((f) => ({
        Fecha: formatDate(f.date),
        Entidad: f.entityName,
        'Tipo de documento': f.documentType,
        'Subido por': f.uploadedBy,
        Hora: formatTime(f.uploadedAt),
      }));
      const ws = XLSX.utils.json_to_sheet(hoja);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Actividad');
      XLSX.writeFile(wb, `control-documentos-${tab.key}-${dateFrom}_${dateTo}.xlsx`);

      if (total > EXPORT_MAX_ROWS) {
        setError(`El rango tiene ${total} registros; se exportaron los ${EXPORT_MAX_ROWS} más recientes.`);
      }
    } catch {
      setError('No se pudo exportar el log.');
    } finally {
      setExportando(false);
    }
  }

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <section className="space-y-3 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">Log de actividad</h3>
          <p className="text-xs text-slate-500">Documentos subidos en el rango seleccionado</p>
        </div>
        <button
          type="button"
          onClick={() => void exportar()}
          disabled={exportando || !data || data.total === 0}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-40"
        >
          <TableIcon className="h-4 w-4" />
          {exportando ? 'Exportando…' : 'Exportar a Excel'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Desde
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Hasta
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const hoy = new Date();
              aplicarRango(hoy, hoy);
            }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => {
              const hoy = new Date();
              const inicio = new Date();
              // Semana de lunes a hoy.
              const dia = (hoy.getDay() + 6) % 7;
              inicio.setDate(hoy.getDate() - dia);
              aplicarRango(inicio, hoy);
            }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => {
              const hoy = new Date();
              const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
              aplicarRango(inicio, hoy);
            }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
          >
            Este mes
          </button>
        </div>

        {data && (
          <p className="text-sm text-slate-500">
            {data.total} {data.total === 1 ? 'documento' : 'documentos'}
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{error}</p>
      )}

      {loading && !data ? (
        <p className="py-8 text-center text-sm text-slate-400">Cargando…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          Sin documentos subidos en este rango.
        </p>
      ) : (
        <ScrollableTable>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Tipo de documento</th>
                <th className="px-3 py-2">Subido por</th>
                <th className="px-3 py-2">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((row, i) => (
                <tr key={`${row.uploadedAt}-${i}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{formatDate(row.date)}</td>
                  <td className="px-3 py-2 font-medium text-navy">{row.entityName}</td>
                  <td className="px-3 py-2 text-slate-600">{row.documentType}</td>
                  <td className="px-3 py-2 text-slate-600">{row.uploadedBy}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{formatTime(row.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Página {data.page} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPaginas || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function DocumentStatusReportScreen({
  summary,
  errorKind,
}: {
  summary: DocumentSummary | null;
  errorKind: ErrorKind | null;
}) {
  const [tabActiva, setTabActiva] = useState<DocumentEntityKey>('employees');

  if (errorKind === 'forbidden') return <NoPermissions />;

  const tab = TABS.find((t) => t.key === tabActiva)!;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm text-slate-400">
          <Link href="/transformacion/reportes" className="hover:text-black">
            Reportes
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Control de Documentos por Entidad</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estado de expedientes de empleados, clientes y proveedores, y bitácora de documentos subidos
        </p>
      </header>

      {!summary ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          No se pudo cargar el resumen. Recarga la página para intentar de nuevo.
        </p>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard title="Empleados" block={summary.empleados} />
          <SummaryCard title="Clientes" block={summary.clientes} />
          <SummaryCard title="Proveedores" block={summary.proveedores} />
        </div>
      )}

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTabActiva(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              t.key === tabActiva
                ? 'border-black text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        <EntityList key={`list-${tab.key}`} tab={tab} />
        <ActivityLog key={`log-${tab.key}`} tab={tab} />
      </div>
    </div>
  );
}
