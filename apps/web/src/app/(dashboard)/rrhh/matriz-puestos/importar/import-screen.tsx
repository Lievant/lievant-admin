'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { readError } from '../position-form-dialog';

type Action = 'crear' | 'actualizar' | 'sin cambios';
interface Issue {
  row: number | null;
  message: string;
}
interface ImportResult {
  mode: 'preview' | 'apply';
  applied: boolean;
  fileName: string;
  sheet: string | null;
  division: string;
  divisionHint: string | null;
  /** Áreas que no están en el catálogo y se agregan al confirmar. */
  newAreas: string[];
  positions: { row: number; title: string; area: string; action: Action; activities: number; okrRows: number; objectives: number; kpis: number }[];
  summary: {
    positions: number; created: number; updated: number; unchanged: number; newAreas: number; plazas: number; areas: number; groups: number;
    activities: number; activitiesWithNote: number; objectives: number; okrRows: number; kpis: number;
  };
  warnings: Issue[];
  errors: Issue[];
}

const ACTION_BADGE: Record<Action, string> = {
  crear: 'bg-emerald-50 text-emerald-700',
  actualizar: 'bg-amber-50 text-amber-700',
  'sin cambios': 'bg-slate-100 text-slate-600',
};
const ACTION_LABEL: Record<Action, string> = { crear: 'Crear', actualizar: 'Actualizar', 'sin cambios': 'Sin Cambios' };
const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const MAX_BYTES = 5 * 1024 * 1024;

const issueText = (i: Issue): string => (i.row ? `Fila ${i.row}: ${i.message}` : i.message);

export function ImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [division, setDivision] = useState('');
  // Divisiones activas del catálogo y lo que se dedujo del título de la hoja (null = aún sin archivo).
  const [divisions, setDivisions] = useState<string[]>([]);
  const [inspected, setInspected] = useState<{ hint: string | null; matched: string | null } | null>(null);
  const [busy, setBusy] = useState<'analyzing' | 'applying' | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Solo cuenta la respuesta de la solicitud más reciente.
  const latest = useRef(0);

  // Las divisiones del desplegable salen del catálogo (Configuración › Catálogos).
  useEffect(() => {
    fetch('/api/hr/job-positions/options')
      .then((r) => (r.ok ? (r.json() as Promise<{ divisions?: string[] }>) : null))
      .then((o) => o?.divisions && setDivisions(o.divisions))
      .catch(() => undefined);
  }, []);

  const reset = () => {
    latest.current += 1;
    setPreview(null);
    setDone(null);
    setError(null);
    setBusy(null);
  };

  /** Al elegir el archivo se deduce la división del título de la hoja y se empareja con el catálogo (nunca se crea una). */
  const pickFile = async (next: File | null) => {
    setFile(next);
    reset();
    setInspected(null);
    if (!next) return;
    const ticket = latest.current;
    try {
      const body = new FormData();
      body.set('file', next);
      const res = await fetch('/api/hr/job-positions/import/inspect', { method: 'POST', body });
      if (!res.ok) throw new Error(await readError(res, 'No se pudo leer el archivo.'));
      const info = (await res.json()) as { divisionHint: string | null; division: string | null; divisions: string[] };
      if (ticket !== latest.current) return;
      setDivisions(info.divisions);
      setInspected({ hint: info.divisionHint, matched: info.division });
      // Con coincidencia se preselecciona el nombre del catálogo; sin ella el desplegable queda vacío.
      setDivision(info.division ?? '');
    } catch (err) {
      if (ticket === latest.current) setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
    }
  };

  const send = async (mode: 'preview' | 'apply', div: string): Promise<ImportResult> => {
    const body = new FormData();
    body.set('mode', mode);
    body.set('division', div);
    body.set('file', file as File);
    const res = await fetch('/api/hr/job-positions/import', { method: 'POST', body });
    if (!res.ok) throw new Error(await readError(res, 'No se pudo procesar el archivo.'));
    return (await res.json()) as ImportResult;
  };

  const analyze = async () => {
    if (!file) return setError('Elige un archivo .xlsx.');
    if (!/\.xlsx$/i.test(file.name)) return setError('El archivo debe ser un Excel .xlsx.');
    if (file.size > MAX_BYTES) return setError('El archivo pasa de 5 MB.');
    const ticket = ++latest.current;
    setError(null);
    setDone(null);
    setPreview(null);
    setBusy('analyzing');
    try {
      const div = division.trim();
      if (div === '') return setError('Elige la división del catálogo antes de analizar.');
      const result = await send('preview', div);
      if (ticket !== latest.current) return;
      setPreview(result);
    } catch (err) {
      if (ticket === latest.current) setError(err instanceof Error ? err.message : 'No se pudo procesar el archivo.');
    } finally {
      if (ticket === latest.current) setBusy(null);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    const ticket = ++latest.current;
    setBusy('applying');
    setError(null);
    try {
      const result = await send('apply', division.trim());
      if (ticket !== latest.current) return;
      if (!result.applied) {
        setPreview(result);
        setError('No se importó nada: el archivo tiene errores.');
      } else {
        setDone(result);
        setPreview(null);
      }
    } catch (err) {
      if (ticket === latest.current) setError(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
    } finally {
      if (ticket === latest.current) setBusy(null);
    }
  };

  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const cards: [string, number][] = preview
    ? [
        ['Puestos', preview.summary.positions],
        ['A crear', preview.summary.created],
        ['A actualizar', preview.summary.updated],
        ['Sin cambios', preview.summary.unchanged],
        ['Áreas nuevas', preview.summary.newAreas],
        ['Actividades', preview.summary.activities],
        ['Filas de OKR', preview.summary.okrRows],
        ['KPIs', preview.summary.kpis],
        ['Plazas', preview.summary.plazas],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/rrhh/matriz-puestos" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-black">
          <ChevronLeftIcon className="h-4 w-4" />
          Matriz de Puestos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">Importar Matriz de Puestos desde Excel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sube el archivo de la división, revisa la vista previa y confirma. Reimportar el mismo archivo no duplica nada.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="imp-division" className={LABEL}>División</label>
          <select
            id="imp-division"
            value={division}
            onChange={(e) => { setDivision(e.target.value); reset(); }}
            className={INPUT}
          >
            <option value="">Elige una división…</option>
            {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <p className="text-xs text-slate-400">Las divisiones se administran en Configuración › Catálogos.</p>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="imp-file" className={LABEL}>Archivo (.xlsx, máximo 5 MB)</label>
          <input
            id="imp-file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
            className={cn(INPUT, 'file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium')}
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="button"
            onClick={analyze}
            disabled={busy !== null || !file || division === ''}
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy === 'analyzing' ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {file && inspected && !inspected.matched && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {inspected.hint
            ? `El archivo dice «${inspected.hint}», pero esa división no está en el catálogo. Elige una de la lista antes de analizar (no se crea ninguna automáticamente).`
            : 'No se pudo deducir la división del título del archivo. Elige una de la lista antes de analizar.'}
        </p>
      )}

      {done && (
        <div role="status" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="text-base font-semibold">Importación completada</p>
          <p>
            {done.summary.created} {done.summary.created === 1 ? 'puesto creado' : 'puestos creados'}, {done.summary.updated}{' '}
            {done.summary.updated === 1 ? 'actualizado' : 'actualizados'} y {done.summary.unchanged} sin cambios · {done.warnings.length}{' '}
            {done.warnings.length === 1 ? 'aviso' : 'avisos'}{done.newAreas.length > 0 ? ` · ${done.newAreas.length} ${done.newAreas.length === 1 ? 'área agregada' : 'áreas agregadas'} al catálogo` : ''}.
          </p>
          <Link href="/rrhh/matriz-puestos" className="inline-block rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Ir a la Matriz de Puestos
          </Link>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map(([label, n]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-bold text-navy">{n}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">Hoja: {preview.sheet ?? '—'} · División: {preview.division}</p>

          {preview.newAreas.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              <p className="font-semibold">Área nueva, se agregará al catálogo ({preview.newAreas.length})</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{preview.newAreas.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
          {preview.errors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">Errores que impiden importar ({preview.errors.length})</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{preview.errors.map((e, i) => <li key={i}>{issueText(e)}</li>)}</ul>
            </div>
          )}
          {preview.warnings.length > 0 && (
            <details className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <summary className="cursor-pointer font-semibold">Avisos ({preview.warnings.length}): no impiden importar</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">{preview.warnings.map((w, i) => <li key={i}>{issueText(w)}</li>)}</ul>
            </details>
          )}

          {preview.positions.length > 0 && (
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {['Fila', 'Puesto', 'Área', 'Acción', 'Actividades', 'OKRs', 'KPIs'].map((c) => <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.positions.map((p) => (
                    <tr key={p.row}>
                      <td className="px-4 py-2.5 text-slate-500">{p.row}</td>
                      <td className="px-4 py-2.5 font-medium text-navy">{p.title}</td>
                      <td className="px-4 py-2.5 text-slate-600">{p.area}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', ACTION_BADGE[p.action])}>{ACTION_LABEL[p.action]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.activities}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {p.okrRows} ({p.objectives} {p.objectives === 1 ? 'objetivo' : 'objetivos'})
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p.kpis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={confirm}
              disabled={busy !== null || hasErrors || preview.positions.length === 0}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy === 'applying' ? 'Importando…' : 'Confirmar Importación'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
