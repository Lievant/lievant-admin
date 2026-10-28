'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { PositionFormDialog } from './position-form-dialog';
import {
  EMPTY_OPTIONS,
  levelOptionLabel,
  STATUS_BADGE,
  STATUS_LABELS,
  VALIDATION_BADGE,
  VALIDATION_LABELS,
  VALIDATION_STATUSES,
  type PositionListItem,
  type PositionOptions,
  type PositionStatus,
} from './positions-constants';

interface PositionPage {
  data: PositionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZE = 25;
const SELECT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const COLUMNS = ['Código', 'Puesto', 'División', 'Área', 'Nivel', 'Plazas', 'Validación', 'Estado'];

export function PositionsScreen() {
  const canCreate = usePermission('rrhh', 'matriz-puestos', 'create');
  const canImport = usePermission('rrhh', 'matriz-puestos', 'import');

  const [options, setOptions] = useState<PositionOptions>(EMPTY_OPTIONS);
  const [division, setDivision] = useState('');
  const [area, setArea] = useState('');
  const [level, setLevel] = useState('');
  const [seniority, setSeniority] = useState('');
  const [status, setStatus] = useState('');
  const [validation, setValidation] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PositionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // Solo cuenta la respuesta de la consulta más reciente (si no, una respuesta lenta pisa a una nueva).
  const latest = useRef(0);

  // La búsqueda espera a que se deje de escribir.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadOptions = useCallback(() => {
    fetch('/api/hr/job-positions/options')
      .then((r) => (r.ok ? (r.json() as Promise<PositionOptions>) : null))
      .then((o) => o && setOptions(o))
      .catch(() => undefined);
  }, []);
  useEffect(loadOptions, [loadOptions]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (division) q.set('division', division);
    if (area) q.set('area', area);
    if (level) q.set('level', level);
    if (seniority) q.set('seniority', seniority);
    if (status) q.set('status', status);
    if (validation) q.set('validationStatus', validation);
    if (debounced) q.set('search', debounced);
    const ticket = ++latest.current;
    try {
      const res = await fetch(`/api/hr/job-positions?${q}`);
      if (!res.ok) throw new Error(res.status === 403 ? 'No tienes permisos para ver la Matriz de Puestos.' : 'No se pudo cargar la lista.');
      const data = (await res.json()) as PositionPage;
      if (ticket === latest.current) setResult(data);
    } catch (err) {
      if (ticket !== latest.current) return;
      setResult(null);
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [page, division, area, level, seniority, status, validation, debounced]);
  useEffect(() => {
    void load();
  }, [load]);

  // Cambiar un filtro regresa a la primera página.
  const onFilter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  const filtered = Boolean(division || area || level || seniority || status || validation || debounced);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">Matriz de Puestos</h1>
          <p className="mt-1 text-sm text-slate-500">Puestos de trabajo con sus actividades, OKRs y KPIs base</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImport && (
            <Link href="/rrhh/matriz-puestos/importar" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50">
              Importar desde Excel
            </Link>
          )}
          {canCreate && (
            <button type="button" onClick={() => setCreating(true)} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              Nuevo Puesto
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="flex flex-col gap-1 lg:col-span-1">
          <label htmlFor="mp-search" className={LABEL}>Buscar</label>
          <input id="mp-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Código o puesto" className={SELECT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-division" className={LABEL}>División</label>
          <select id="mp-division" value={division} onChange={onFilter(setDivision)} className={SELECT}>
            <option value="">Todas</option>
            {options.divisions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-area" className={LABEL}>Área</label>
          <select id="mp-area" value={area} onChange={onFilter(setArea)} className={SELECT}>
            <option value="">Todas</option>
            {options.areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-level" className={LABEL}>Nivel</label>
          <select id="mp-level" value={level} onChange={onFilter(setLevel)} className={SELECT}>
            <option value="">Todos</option>
            {options.levels.map((l) => <option key={l.code} value={l.code}>{levelOptionLabel(l)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-seniority" className={LABEL}>Categoría</label>
          <select id="mp-seniority" value={seniority} onChange={onFilter(setSeniority)} className={SELECT}>
            <option value="">Todas</option>
            {options.seniorities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-status" className={LABEL}>Estado</label>
          <select id="mp-status" value={status} onChange={onFilter(setStatus)} className={SELECT}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABELS) as PositionStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-validation" className={LABEL}>Validación</label>
          <select id="mp-validation" value={validation} onChange={onFilter(setValidation)} className={SELECT}>
            <option value="">Todas</option>
            {VALIDATION_STATUSES.map((v) => <option key={v} value={v}>{VALIDATION_LABELS[v]}</option>)}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <p className="text-sm text-slate-600">
          <strong>{result.total}</strong> {result.total === 1 ? 'puesto' : 'puestos'}
        </p>
      )}

      {loading && !result ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : result && result.total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          {filtered ? 'No Hay Puestos Con Esos Filtros' : 'Aún No Hay Puestos Registrados'}
        </div>
      ) : (
        result && (
          <>
            {/* El scroll horizontal vive dentro del contenedor, no en la página. */}
            <div className={cn('max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', loading && 'opacity-60')}>
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {COLUMNS.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-600">{p.code}</td>
                      <td className="px-4 py-3">
                        <Link href={`/rrhh/matriz-puestos/${p.id}`} className="font-medium text-navy hover:underline">{p.title}</Link>
                        {!p.hasDescription && <p className="text-xs text-slate-400">Descripción de puesto pendiente</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.division ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.area}</td>
                      <td className="px-4 py-3 text-slate-600">{p.level ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {p.vacant ? <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">Vacante</span> : (p.plazas ?? '—')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', VALIDATION_BADGE[p.validationStatus])}>{VALIDATION_LABELS[p.validationStatus]}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE[p.status])}>{STATUS_LABELS[p.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>Página {result.page} de {result.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={loading || result.page <= 1} onClick={() => setPage(result.page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50">
                  Anterior
                </button>
                <button type="button" disabled={loading || result.page >= result.totalPages} onClick={() => setPage(result.page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50">
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )
      )}

      {creating && (
        <PositionFormDialog
          position={null}
          options={options}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            loadOptions();
            void load();
          }}
        />
      )}
    </div>
  );
}
