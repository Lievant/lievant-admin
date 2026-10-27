'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import { EmployeePicker, type EmployeePickerValue } from '@/app/(dashboard)/rrhh/empleados/employee-picker';
import {
  DEVELOPMENT_TYPE_OPTIONS,
  LEVEL_OPTIONS,
  developmentTypeLabel,
  formatDay,
  type DevelopmentType,
} from '@/app/(dashboard)/rrhh/empleados/training-constants';

interface RiacItem {
  employeeDisplayId: string;
  employeeName: string;
  area: string | null;
  position: string;
  name: string;
  institution: string;
  developmentType: DevelopmentType;
  level: string | null;
  startDate: string;
  endDate: string | null;
  duration: string;
  isCompanyRecognition: boolean;
}

interface RiacPage {
  data: RiacItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Applied {
  from: string;
  to: string;
  type: string;
  area: string;
  division: string;
  employeeId: string;
}

const PAGE_SIZE = 25;
const TYPE_OPTIONS = [...DEVELOPMENT_TYPE_OPTIONS, { value: 'reconocimientos', label: 'Reconocimientos' }];
const COLUMNS = [
  'ID Empleado', 'Nombre', 'Área', 'Cargo', 'Curso / Certificado', 'Institución', 'Tipo', 'Nivel',
  'Fecha de Inicio', 'Fecha de Fin', 'Duración', 'Reconocimiento',
];
const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

/** 'AAAA-MM-DD' de hoy en la oficina (America/Mexico_City). */
function todayMx(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function query(a: Applied, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ from: a.from, to: a.to, ...extra });
  if (a.type) q.set('type', a.type);
  if (a.area) q.set('area', a.area);
  if (a.division) q.set('division', a.division);
  if (a.employeeId) q.set('employeeId', a.employeeId);
  return q.toString();
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!body?.message) return res.status === 403 ? 'No tienes permisos para ver este reporte.' : fallback;
  return Array.isArray(body.message) ? body.message.join(' ') : body.message;
}

export function RiacScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [area, setArea] = useState('');
  const [division, setDivision] = useState('');
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);

  const [applied, setApplied] = useState<Applied | null>(null);
  const [result, setResult] = useState<RiacPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Periodo inicial: del 1 de enero de este año a hoy.
  useEffect(() => {
    const today = todayMx();
    setFrom(`${today.slice(0, 4)}-01-01`);
    setTo(today);
    fetch('/api/employees/trainings/report/options')
      .then((r) => (r.ok ? (r.json() as Promise<{ areas: string[]; divisions: string[] }>) : null))
      .then((o) => {
        if (o) {
          setAreas(o.areas);
          setDivisions(o.divisions);
        }
      })
      .catch(() => undefined);
  }, []);

  const fetchPage = useCallback(async (a: Applied, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/trainings/report?${query(a, { page: String(page), limit: String(PAGE_SIZE) })}`);
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo generar el reporte.'));
      setResult((await res.json()) as RiacPage);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'No se pudo generar el reporte.');
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError('Elige las fechas Desde y Hasta.');
    if (from > to) return setError('La fecha Desde no puede ser mayor que Hasta.');
    const next: Applied = { from, to, type, area, division, employeeId: employee?.id ?? '' };
    setApplied(next);
    void fetchPage(next, 1);
  };

  const exportExcel = async () => {
    if (!applied) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/trainings/report/export?${query(applied)}`);
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo exportar el reporte.'));
      const blob = await res.blob();
      const match = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? `RIAC-${applied.from}-${applied.to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el reporte.');
    } finally {
      setExporting(false);
    }
  };

  const levelLabel = (v: string | null) => LEVEL_OPTIONS.find((o) => o.value === v)?.label ?? '';

  return (
    <div className="space-y-5">
      <div>
        <Link href="/rrhh/reportes" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-black">
          <ChevronLeftIcon className="h-4 w-4" />
          Reportes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">RIAC</h1>
        <p className="text-sm text-slate-500">Registro Individual de Administración de Competencias</p>
      </div>

      <form onSubmit={generate} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="riac-from" className={LABEL}>Desde</label>
            <input id="riac-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="riac-to" className={LABEL}>Hasta</label>
            <input id="riac-to" type="date" required value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="riac-type" className={LABEL}>Tipo</label>
            <select id="riac-type" value={type} onChange={(e) => setType(e.target.value)} className={INPUT}>
              <option value="">Todos</option>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="riac-area" className={LABEL}>Área</label>
            <select id="riac-area" value={area} onChange={(e) => setArea(e.target.value)} className={INPUT}>
              <option value="">Todas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="riac-division" className={LABEL}>División</label>
            <select id="riac-division" value={division} onChange={(e) => setDivision(e.target.value)} className={INPUT}>
              <option value="">Todas</option>
              {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <EmployeePicker id="riac-employee" label="Colaborador (Opcional, Mínimo 2 Letras)" value={employee} onSelect={setEmployee} />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Entran las capacitaciones cuyo periodo se traslapa con el rango: empiezan antes de &quot;Hasta&quot; y terminan después de
          &quot;Desde&quot;. Las que están &quot;En Curso&quot; cuentan como abiertas hasta hoy. Solo colaboradores activos.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="rounded-md bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
            {loading ? 'Generando…' : 'Generar'}
          </button>
          {result && result.total > 0 && (
            <button
              type="button"
              onClick={exportExcel}
              disabled={exporting}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60"
            >
              {exporting ? 'Exportando…' : 'Exportar a Excel'}
            </button>
          )}
        </div>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{result.total}</strong> {result.total === 1 ? 'registro' : 'registros'}
          </p>

          {result.total === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
              No Hay Capacitaciones En El Periodo Seleccionado
            </div>
          ) : (
            <>
              {/* El scroll horizontal vive dentro del contenedor, no en la página. */}
              <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {COLUMNS.map((c) => <th key={c} className="whitespace-nowrap px-3 py-3">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.data.map((r, i) => (
                      <tr key={`${r.employeeDisplayId}-${r.name}-${r.startDate}-${i}`} className="align-top">
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">{r.employeeDisplayId}</td>
                        <td className="px-3 py-3 font-medium text-navy">{r.employeeName}</td>
                        <td className="px-3 py-3 text-slate-600">{r.area ?? '—'}</td>
                        <td className="px-3 py-3 text-slate-600">{r.position}</td>
                        <td className="px-3 py-3 text-navy">{r.name}</td>
                        <td className="px-3 py-3 text-slate-600">{r.institution}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{developmentTypeLabel(r.developmentType)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{levelLabel(r.level) || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDay(r.startDate)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.endDate ? formatDay(r.endDate) : 'En Curso'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.duration || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.isCompanyRecognition ? 'Sí' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <span>Página {result.page} de {result.totalPages}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading || result.page <= 1 || !applied}
                    onClick={() => applied && void fetchPage(applied, result.page - 1)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={loading || result.page >= result.totalPages || !applied}
                    onClick={() => applied && void fetchPage(applied, result.page + 1)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
