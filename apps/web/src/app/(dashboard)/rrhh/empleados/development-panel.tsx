'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  currentPeriod,
  currentYearMx,
  formatPct,
  frequencyLabel,
  makePeriod,
  parsePeriod,
  periodLabel,
  weightState,
  yearOptions,
  type Frequency,
} from '../matriz-puestos/positions-constants';

interface PositionSummary {
  id: string;
  code: string;
  title: string;
  area: string;
  level: string | null;
}
interface DevOkr { id: string; objective: string; keyResult: string; weight: number | null }
interface DevKpi { id: string; name: string; description: string | null; targetValue: string | null; measurementFrequency: Frequency | null }
interface Development {
  employeeId: string;
  position: PositionSummary | null;
  description: string | null;
  descriptionPending: boolean;
  suggestedPosition: PositionSummary | null;
  period: string;
  periodsWithData: string[];
  okrs: DevOkr[];
  weightSum: number;
  kpis: DevKpi[];
}
interface AssignSummary { okrsCopied: number; okrsSkipped: number; kpisCopied: number; kpisSkipped: number }

type Source = { mode: 'rrhh'; employeeId: string; canWrite: boolean } | { mode: 'mine' };

const SELECT = 'rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const CARD = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';

async function apiError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!body?.message) return res.status === 403 ? 'No tienes permiso para esta acción.' : fallback;
  return Array.isArray(body.message) ? body.message.join(' ') : body.message;
}

/**
 * Desarrollo Organizacional de un colaborador: puesto, descripción aprobada,
 * OKRs del periodo y KPIs (copias del puesto en la Matriz). Es el mismo panel
 * para RRHH (expediente, con edición si hay `write`) y para el colaborador (Mi
 * Información, solo lectura): cambia solo el origen de los datos.
 */
export function DevelopmentPanel(props: Source) {
  const rrhh = props.mode === 'rrhh';
  const canWrite = props.mode === 'rrhh' && props.canWrite;
  const base = props.mode === 'rrhh' ? `/api/hr/employee-development/${props.employeeId}` : '/api/employees/my-profile/development';

  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<Development | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<PositionSummary[]>([]);
  const [choice, setChoice] = useState('');
  const [toRemove, setToRemove] = useState<{ kind: 'okrs' | 'kpis'; id: string; label: string } | null>(null);

  // Solo cuenta la respuesta de la consulta más reciente (si no, una respuesta lenta pisa a una nueva).
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const res = await fetch(`${base}?period=${period}`);
      if (!res.ok) throw new Error(await apiError(res, 'No se pudo cargar el desarrollo organizacional.'));
      const d = (await res.json()) as Development;
      if (ticket !== latest.current) return;
      setData(d);
      setError(null);
    } catch (err) {
      if (ticket !== latest.current) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar el desarrollo organizacional.');
    }
  }, [base, period]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canWrite) return;
    fetch('/api/hr/employee-development/position-options')
      .then((r) => (r.ok ? (r.json() as Promise<PositionSummary[]>) : []))
      .then(setOptions)
      .catch(() => undefined);
  }, [canWrite]);

  const run = async (fn: () => Promise<Response>, fallback: string, after: (res: Response) => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fn();
      if (!res.ok) throw new Error(await apiError(res, fallback));
      await after(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const setPosition = (jobPositionId: string | null) =>
    run(
      () => fetch(`${base}/position`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobPositionId }) }),
      'No se pudo cambiar el puesto.',
      async () => {
        setChoice('');
        await load();
      },
    );

  const assign = () =>
    run(
      () => fetch(`${base}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) }),
      'No se pudieron asignar los OKRs y KPIs.',
      async (res) => {
        const { summary } = (await res.json()) as { summary: AssignSummary };
        setNotice(
          `Asignación lista: ${summary.okrsCopied} OKRs y ${summary.kpisCopied} KPIs copiados; ${summary.okrsSkipped} OKRs y ${summary.kpisSkipped} KPIs ya estaban asignados.`,
        );
        await load();
      },
    );

  const remove = () => {
    if (!toRemove) return;
    return run(
      () => fetch(`/api/hr/employee-${toRemove.kind}/${toRemove.id}`, { method: 'DELETE' }),
      'No se pudo quitar.',
      async () => {
        setToRemove(null);
        await load();
      },
    );
  };

  if (!data) return error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : <p className="text-sm text-slate-400">Cargando…</p>;

  const parsed = parsePeriod(period) ?? { year: currentYearMx(), semester: 1 as const };
  const state = weightState(data.weightSum, data.okrs.length);
  const others = data.periodsWithData.filter((p) => p !== period);

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      {/* Puesto */}
      <div className={CARD}>
        <h2 className="text-sm font-semibold text-navy">Puesto</h2>
        {data.position ? (
          <p className="mt-3 text-sm text-navy">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{data.position.code}</span>{' '}
            <span className="font-medium">{data.position.title}</span>
            <span className="text-slate-500"> · {[data.position.area, data.position.level].filter(Boolean).join(' · ')}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Sin puesto asignado</p>
        )}

        {canWrite && (
          <div className="mt-4 space-y-3">
            {!data.position && data.suggestedPosition && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
                <span>Puesto sugerido: <strong>{data.suggestedPosition.title}</strong> ({data.suggestedPosition.code})</span>
                <button type="button" disabled={busy} onClick={() => setPosition(data.suggestedPosition!.id)} className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">Vincular</button>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="dev-position" className={LABEL}>{data.position ? 'Cambiar Puesto' : 'Vincular Puesto'}</label>
                <select id="dev-position" value={choice} onChange={(e) => setChoice(e.target.value)} className={cn(SELECT, 'max-w-full sm:w-80')}>
                  <option value="">Selecciona…</option>
                  {options.filter((o) => o.id !== data.position?.id).map((o) => <option key={o.id} value={o.id}>{o.title} ({o.code})</option>)}
                </select>
              </div>
              <button type="button" disabled={busy || !choice} onClick={() => setPosition(choice)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-50">Guardar Puesto</button>
              {data.position && (
                <button type="button" disabled={busy} onClick={() => setPosition(null)} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">Desvincular</button>
              )}
            </div>
            <p className="text-xs text-slate-400">Cambiar de puesto no borra los OKRs y KPIs ya asignados.</p>
          </div>
        )}
      </div>

      {/* Descripción */}
      <div className={CARD}>
        <h2 className="text-sm font-semibold text-navy">Descripción del Puesto</h2>
        {!data.position ? (
          <p className="mt-3 text-sm text-slate-400">Sin puesto asignado</p>
        ) : data.description ? (
          <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{data.description}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Descripción de puesto pendiente</p>
        )}
      </div>

      {/* OKRs */}
      <div className={CARD}>
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-sm font-semibold text-navy">OKRs</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="dev-year" className={LABEL}>Año</label>
            <select id="dev-year" value={parsed.year} onChange={(e) => setPeriod(makePeriod(Number(e.target.value), parsed.semester))} className={SELECT}>
              {yearOptions(currentYearMx(), data.periodsWithData.map((p) => parsePeriod(p)?.year ?? 0).filter(Boolean)).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="dev-sem" className={LABEL}>Semestre</label>
            <select id="dev-sem" value={parsed.semester} onChange={(e) => setPeriod(makePeriod(parsed.year, Number(e.target.value) as 1 | 2))} className={SELECT}>
              <option value={1}>Semestre 1</option>
              <option value={2}>Semestre 2</option>
            </select>
          </div>
          {canWrite && (
            <button type="button" disabled={busy || !data.position} onClick={assign} title={data.position ? undefined : 'Vincula un puesto primero'} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
              {busy ? 'Asignando…' : 'Asignar OKRs y KPIs del Puesto'}
            </button>
          )}
        </div>

        <p className={cn('mt-3 rounded-lg px-3 py-2 text-sm', state === 'complete' && 'bg-emerald-50 text-emerald-800', state === 'incomplete' && 'bg-amber-50 text-amber-800', state === 'over' && 'bg-red-50 text-red-700', state === 'empty' && 'bg-slate-50 text-slate-500')}>
          <strong>{periodLabel(period)}</strong> · Suma: {formatPct(data.weightSum)}
          {state === 'empty' && ' · Sin OKRs en este periodo'}
        </p>
        {others.length > 0 && <p className="mt-2 text-xs text-slate-400">Otros periodos con OKRs: {others.map(periodLabel).join(', ')}</p>}

        {data.okrs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No hay OKRs asignados en este periodo.</p>
        ) : (
          <div className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Objetivo</th>
                  <th className="px-3 py-2">Resultado Clave</th>
                  <th className="whitespace-nowrap px-3 py-2">Peso</th>
                  {canWrite && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.okrs.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="whitespace-pre-line px-3 py-2 text-navy">{o.objective}</td>
                    <td className="whitespace-pre-line px-3 py-2 text-slate-700">{o.keyResult}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{o.weight !== null ? formatPct(o.weight) : '—'}</td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" onClick={() => setToRemove({ kind: 'okrs', id: o.id, label: o.objective })} className="text-xs font-medium text-red-600 hover:underline">Quitar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className={CARD}>
        <h2 className="text-sm font-semibold text-navy">KPIs</h2>
        {data.kpis.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No hay KPIs asignados.</p>
        ) : (
          <div className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Meta</th>
                  <th className="px-3 py-2">Frecuencia</th>
                  {canWrite && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.kpis.map((k) => (
                  <tr key={k.id} className="align-top">
                    <td className="px-3 py-2 font-medium text-navy">{k.name}</td>
                    <td className="whitespace-pre-line px-3 py-2 text-slate-700">{k.description ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{k.targetValue ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{frequencyLabel(k.measurementFrequency)}</td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" onClick={() => setToRemove({ kind: 'kpis', id: k.id, label: k.name })} className="text-xs font-medium text-red-600 hover:underline">Quitar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rrhh && <p className="text-xs text-slate-400">Los OKRs y KPIs son una copia del puesto en la Matriz de Puestos: si el puesto cambia, vuelve a pulsar &quot;Asignar&quot; y solo se copian los nuevos.</p>}

      {toRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">Quitar {toRemove.kind === 'okrs' ? 'OKR' : 'KPI'}</h2>
            <p className="mt-3 text-sm text-slate-600">¿Quitar <strong>{toRemove.label}</strong> de este colaborador?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setToRemove(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
              <button type="button" onClick={remove} disabled={busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Quitando…' : 'Quitar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
