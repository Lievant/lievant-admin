'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { EmployeePicker, type EmployeePickerValue } from '@/app/(dashboard)/rrhh/empleados/employee-picker';
import { currentPeriod, formatPct, periodLabel } from '@/app/(dashboard)/rrhh/matriz-puestos/positions-constants';

interface Row {
  employeeId: string;
  employeeName: string;
  area: string | null;
  leaderName: string | null;
  period: string;
  objective: string;
  keyResult: string;
  weight: number | null;
  score: number | null;
  status: 'pendiente' | 'completada';
}
interface EmployeeSummary { employeeId: string; employeeName: string; area: string | null; period: string; average: number | null; evaluated: number; assigned: number }
interface AreaSummary { area: string | null; period: string; average: number | null; employees: number }
interface PeriodSummary { period: string; average: number | null; employees: number }
interface Report {
  data: Row[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { evaluated: number; assigned: number; average: number | null; byEmployee: EmployeeSummary[]; byArea: AreaSummary[]; byPeriod: PeriodSummary[] };
}

const PAGE_SIZE = 25;
const ALL = '__todos__';
const SELECT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const COLUMNS = ['Colaborador', 'Área', 'Líder Directo', 'Periodo', 'Objetivo', 'Resultado Clave', 'Peso', 'Calificación', 'Estado'];

const fmt = (n: number | null) => (n === null ? '—' : String(n));

function Card({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      <div className="mt-3 max-h-72 overflow-auto">{children}</div>
    </div>
  );
}

export function OkrsReportScreen() {
  const [periods, setPeriods] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [area, setArea] = useState('');
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Solo cuenta la respuesta de la consulta más reciente (si no, una respuesta lenta pisa a una nueva).
  const latest = useRef(0);

  useEffect(() => {
    fetch('/api/hr/okr-evaluations/report/options')
      .then((r) => (r.ok ? (r.json() as Promise<{ periods: string[]; areas: string[] }>) : null))
      .then((o) => {
        if (o) {
          setPeriods(o.periods);
          setAreas(o.areas);
        }
      })
      .catch(() => undefined);
  }, []);

  const query = useCallback(
    (extra: Record<string, string> = {}) => {
      const q = new URLSearchParams(extra);
      if (period !== ALL) q.set('period', period);
      if (area) q.set('area', area);
      if (employee) q.set('employeeId', employee.id);
      return q.toString();
    },
    [period, area, employee],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ticket = ++latest.current;
    try {
      const res = await fetch(`/api/hr/okr-evaluations/report?${query({ page: String(page), limit: String(PAGE_SIZE) })}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(body?.message) ? body?.message.join(' · ') : body?.message;
        throw new Error(msg || (res.status === 403 ? 'No tienes permisos para ver este reporte.' : 'No se pudo cargar el reporte.'));
      }
      const data = (await res.json()) as Report;
      if (ticket === latest.current) setReport(data);
    } catch (err) {
      if (ticket !== latest.current) return;
      setReport(null);
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportExcel = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/hr/okr-evaluations/report/export?${query()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(body?.message) ? body?.message.join(' · ') : body?.message;
        throw new Error(msg || 'No se pudo exportar el reporte.');
      }
      const blob = await res.blob();
      const match = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? `OKRs-${period === ALL ? 'Todos' : period}.xlsx`;
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

  const periodOptions = [...new Set([currentPeriod(), ...periods])].sort().reverse();
  const s = report?.summary;
  const filtered = Boolean(area || employee || period === ALL);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/rrhh/reportes" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-black">
          <ChevronLeftIcon className="h-4 w-4" />
          Reportes
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">OKRs</h1>
        <p className="text-sm text-slate-500">Evaluación semestral de los OKRs por los líderes</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="ok-period" className={LABEL}>Periodo</label>
          <select id="ok-period" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} className={SELECT}>
            <option value={ALL}>Todos</option>
            {periodOptions.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ok-area" className={LABEL}>Área</label>
          <select id="ok-area" value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} className={SELECT}>
            <option value="">Todas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <EmployeePicker id="ok-employee" label="Colaborador (Opcional, Mínimo 2 Letras)" value={employee} onSelect={(e) => { setEmployee(e); setPage(1); }} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {s && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card label="OKRs Evaluados / Asignados" value={`${s.evaluated} / ${s.assigned}`} hint={s.assigned > 0 ? `${formatPct(Math.round((s.evaluated / s.assigned) * 1000) / 10)} de avance` : undefined} />
            <Card label="Promedio General" value={fmt(s.average)} hint="Promedio simple de los promedios por colaborador" />
            <Card label="Colaboradores Con Promedio" value={String(s.byEmployee.filter((e) => e.average !== null).length)} hint={`de ${s.byEmployee.length}`} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Block title="Promedio por Colaborador">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-400"><th className="pb-2">Colaborador</th><th className="pb-2">Periodo</th><th className="pb-2 text-right">Prom.</th><th className="pb-2 text-right">Avance</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {s.byEmployee.map((e) => (
                    <tr key={`${e.employeeId}-${e.period}`}>
                      <td className="py-1.5 pr-2 text-navy">{e.employeeName}</td>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-slate-500">{e.period}</td>
                      <td className="py-1.5 text-right font-medium text-navy">{fmt(e.average)}</td>
                      <td className="whitespace-nowrap py-1.5 text-right text-slate-500">{e.evaluated}/{e.assigned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
            <Block title="Promedio por Área">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-400"><th className="pb-2">Área</th><th className="pb-2">Periodo</th><th className="pb-2 text-right">Prom.</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {s.byArea.map((a) => (
                    <tr key={`${a.area}-${a.period}`}>
                      <td className="py-1.5 pr-2 text-navy">{a.area ?? 'Sin área'}</td>
                      <td className="whitespace-nowrap py-1.5 pr-2 text-slate-500">{a.period}</td>
                      <td className="py-1.5 text-right font-medium text-navy">{fmt(a.average)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
            <Block title="Promedio por Periodo">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-400"><th className="pb-2">Periodo</th><th className="pb-2 text-right">Prom.</th><th className="pb-2 text-right">Colab.</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {s.byPeriod.map((p) => (
                    <tr key={p.period}>
                      <td className="py-1.5 text-navy">{periodLabel(p.period)}</td>
                      <td className="py-1.5 text-right font-medium text-navy">{fmt(p.average)}</td>
                      <td className="py-1.5 text-right text-slate-500">{p.employees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{report ? <><strong>{report.total}</strong> {report.total === 1 ? 'OKR' : 'OKRs'}</> : null}</p>
        {report && report.total > 0 && (
          <button type="button" onClick={exportExcel} disabled={exporting} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60">
            {exporting ? 'Exportando…' : 'Exportar a Excel'}
          </button>
        )}
      </div>

      {loading && !report ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : report && report.total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          {filtered ? 'No Hay OKRs Con Esos Filtros' : 'No Hay OKRs Asignados En Este Periodo'}
        </div>
      ) : (
        report && (
          <>
            <div className={cn('max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', loading && 'opacity-60')}>
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {COLUMNS.map((c) => <th key={c} className="whitespace-nowrap px-3 py-3">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.data.map((r, i) => (
                    <tr key={`${r.employeeId}-${r.period}-${i}`} className="align-top">
                      <td className="px-3 py-3 font-medium text-navy">{r.employeeName}</td>
                      <td className="px-3 py-3 text-slate-600">{r.area ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{r.leaderName ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.period}</td>
                      <td className="whitespace-pre-line px-3 py-3 text-navy">{r.objective}</td>
                      <td className="whitespace-pre-line px-3 py-3 text-slate-600">{r.keyResult}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.weight !== null ? formatPct(r.weight) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-navy">{fmt(r.score)}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', r.status === 'completada' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{r.status === 'completada' ? 'Evaluado' : 'Pendiente'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>Página {report.page} de {report.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={loading || report.page <= 1} onClick={() => setPage(report.page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50">Anterior</button>
                <button type="button" disabled={loading || report.page >= report.totalPages} onClick={() => setPage(report.page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50">Siguiente</button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
