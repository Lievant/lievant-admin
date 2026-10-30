'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ModalShell } from '@/app/(dashboard)/rrhh/matriz-puestos/modal-shell';
import { readError } from '@/app/(dashboard)/rrhh/matriz-puestos/position-form-dialog';
import { refreshCompetenciesAction } from './actions';

type Action = 'crear' | 'actualizar' | 'sin cambios' | 'restaurar';
interface Issue {
  row: number | null;
  message: string;
}
interface ImportResult {
  mode: 'preview' | 'apply';
  applied: boolean;
  fileName: string;
  sheet: string | null;
  summary: { create: number; update: number; unchanged: number; restore: number; errors: number; warnings: number };
  rows: { row: number; name: string; description: string | null; order: number; action: Action }[];
  warnings: Issue[];
  errors: Issue[];
}

const ACTION_BADGE: Record<Action, string> = {
  crear: 'bg-emerald-50 text-emerald-700',
  actualizar: 'bg-amber-50 text-amber-700',
  'sin cambios': 'bg-slate-100 text-slate-600',
  restaurar: 'bg-sky-50 text-sky-700',
};
const ACTION_LABEL: Record<Action, string> = { crear: 'Crear', actualizar: 'Actualizar', 'sin cambios': 'Sin Cambios', restaurar: 'Restaurar' };
const MAX_BYTES = 5 * 1024 * 1024;

const issueText = (i: Issue): string => (i.row ? `Fila ${i.row}: ${i.message}` : i.message);

function Counter({ label, value, tone }: { label: string; value: number; tone?: string | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 text-center">
      <p className={cn('text-xl font-bold text-navy', tone)}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

/**
 * Importación de competencias desde Excel (patrón de la Matriz de Puestos): elegir el archivo, ver la vista previa
 * (contadores y una fila por competencia) y confirmar. El archivo viaja por la ruta proxy `/api/catalogs/competencies/import`.
 */
export function CompetenciesImportDialog({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'analyzing' | 'applying' | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Solo cuenta la respuesta de la solicitud más reciente.
  const latest = useRef(0);

  const send = async (mode: 'preview' | 'apply'): Promise<ImportResult> => {
    const body = new FormData();
    body.set('mode', mode);
    body.set('file', file as File);
    const res = await fetch('/api/catalogs/competencies/import', { method: 'POST', body });
    if (!res.ok) throw new Error(await readError(res, 'No se pudo procesar el archivo.'));
    return (await res.json()) as ImportResult;
  };

  const pick = (f: File | null) => {
    latest.current++;
    setFile(f);
    setPreview(null);
    setDone(null);
    setError(null);
    setBusy(null);
  };

  const analyze = async () => {
    if (!file) return setError('Elige un archivo .xlsx.');
    if (!/\.xlsx$/i.test(file.name)) return setError('El archivo debe ser un Excel .xlsx.');
    if (file.size > MAX_BYTES) return setError('El archivo pasa de 5 MB.');
    const ticket = ++latest.current;
    setError(null);
    setPreview(null);
    setBusy('analyzing');
    try {
      const result = await send('preview');
      if (ticket === latest.current) setPreview(result);
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
      const result = await send('apply');
      if (ticket !== latest.current) return;
      if (!result.applied) {
        setPreview(result);
        setError('No se importó nada: el archivo tiene errores.');
      } else {
        setDone(result);
        setPreview(null);
        await refreshCompetenciesAction(); // refresca la tabla y la tarjeta del catálogo
      }
    } catch (err) {
      if (ticket === latest.current) setError(err instanceof Error ? err.message : 'No se pudo importar el archivo.');
    } finally {
      if (ticket === latest.current) setBusy(null);
    }
  };

  const result = done ?? preview;
  const hasErrors = (preview?.errors.length ?? 0) > 0;

  return (
    <ModalShell
      title="Importar Competencias desde Excel"
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">
            {done ? 'Cerrar' : 'Cancelar'}
          </button>
          {!done && (
            <>
              <button
                type="button"
                onClick={() => void analyze()}
                disabled={!file || busy !== null}
                className="rounded-md border border-black px-4 py-2 text-sm font-semibold text-black hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === 'analyzing' ? 'Analizando…' : 'Vista Previa'}
              </button>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={!preview || hasErrors || busy !== null}
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy === 'applying' ? 'Importando…' : 'Confirmar Importación'}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="comp-file" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Archivo Excel (.xlsx, máximo 5 MB y 500 filas)</label>
          <input
            id="comp-file"
            type="file"
            accept=".xlsx"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy hover:file:bg-slate-200"
          />
          <p className="text-xs text-slate-500">
            Columnas: «Competencia» (obligatoria), y opcionales «ID», «Descripción» y «Orden». Sin «Orden», el «ID» se usa como orden. Reimportar actualiza lo que el archivo traiga y no elimina nada.
          </p>
        </div>

        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {done && (
          <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Importación terminada: {done.summary.create} creadas, {done.summary.update} actualizadas, {done.summary.restore} restauradas y {done.summary.unchanged} sin cambios.
          </p>
        )}

        {result && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Counter label="Crear" value={result.summary.create} tone="text-emerald-700" />
              <Counter label="Actualizar" value={result.summary.update} tone="text-amber-700" />
              <Counter label="Sin Cambios" value={result.summary.unchanged} />
              <Counter label="Restaurar" value={result.summary.restore} tone="text-sky-700" />
              <Counter label="Errores" value={result.summary.errors} tone={result.summary.errors ? 'text-red-600' : undefined} />
              <Counter label="Avisos" value={result.summary.warnings} tone={result.summary.warnings ? 'text-amber-700' : undefined} />
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm font-semibold text-red-700">Errores (no se importa nada hasta corregirlos)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-red-700">
                  {result.errors.map((i, n) => <li key={n}>{issueText(i)}</li>)}
                </ul>
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm font-semibold text-amber-800">Avisos</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-800">
                  {result.warnings.map((i, n) => <li key={n}>{issueText(i)}</li>)}
                </ul>
              </div>
            )}

            {result.rows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Competencia</th>
                      <th className="px-3 py-2">Orden</th>
                      <th className="px-3 py-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.row} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 text-slate-500">{r.row}</td>
                        <td className="px-3 py-1.5 text-navy">{r.name}</td>
                        <td className="px-3 py-1.5 text-slate-600">{r.order}</td>
                        <td className="px-3 py-1.5">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ACTION_BADGE[r.action])}>{ACTION_LABEL[r.action]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}
