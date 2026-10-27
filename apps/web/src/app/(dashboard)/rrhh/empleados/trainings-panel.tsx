'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrainingDialog } from './training-dialog';
import {
  DEVELOPMENT_TYPE_OPTIONS,
  developmentTypeLabel,
  formatDuration,
  formatRange,
  levelLabel,
  trainingQuery,
  yearsOf,
  type TrainingItem,
} from './training-constants';

type Source = { mode: 'rrhh'; employeeId: string; canWrite: boolean } | { mode: 'mine' };

const TYPE_BADGE: Record<string, string> = {
  tecnico: 'bg-blue-50 text-blue-700',
  habilidades_blandas: 'bg-violet-50 text-violet-700',
  academico: 'bg-emerald-50 text-emerald-700',
};

/**
 * Lista de capacitaciones con filtros por tipo y año. Es la misma pantalla para
 * RRHH (expediente, con edición si hay permiso de escritura) y para el
 * colaborador (Mi Información, solo lectura): cambia solo el origen de los datos.
 */
export function TrainingsPanel(props: Source) {
  const base = props.mode === 'rrhh' ? `/api/employees/${props.employeeId}/trainings` : '/api/employees/my-profile/trainings';
  const canWrite = props.mode === 'rrhh' && props.canWrite;

  const [items, setItems] = useState<TrainingItem[] | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [type, setType] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TrainingItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TrainingItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}${trainingQuery(type, year)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as TrainingItem[];
      setItems(data);
      setError(null);
      // Los años disponibles salen de la lista sin filtrar; con filtro activo se conservan.
      if (!type && !year) setYears(yearsOf(data));
    } catch {
      setError('No se pudieron cargar las capacitaciones.');
      setItems([]);
    }
  }, [base, type, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (t: TrainingItem) => {
    setActionError(null);
    try {
      const res = await fetch(`${base}/${t.id}/certificate-url`);
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setActionError('No se pudo abrir el certificado. Intenta de nuevo.');
    }
  };

  const confirmDelete = async () => {
    if (!deleting || props.mode !== 'rrhh') return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${base}/${deleting.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setDeleting(null);
      await load();
    } catch {
      setActionError('No se pudo eliminar la capacitación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="tr-f-type" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de Desarrollo</label>
          <select id="tr-f-type" value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy">
            <option value="">Todos</option>
            {DEVELOPMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tr-f-year" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Año de Inicio</label>
          <select id="tr-f-year" value={year} onChange={(e) => setYear(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy">
            <option value="">Todos</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {canWrite && (
          <button type="button" onClick={() => setEditing('new')} className="ml-auto rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
            Agregar Capacitación
          </button>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {actionError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      {items === null ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          {type || year ? 'No hay capacitaciones con esos filtros.' : 'Aún no hay capacitaciones registradas.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-navy">{t.name}</p>
                  <p className="text-sm text-slate-500">{t.institution}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', TYPE_BADGE[t.developmentType])}>
                    {developmentTypeLabel(t.developmentType)}
                  </span>
                  {t.isCompanyRecognition && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Reconocimiento de la Empresa</span>
                  )}
                  {t.inProgress && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">En Curso</span>
                  )}
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Periodo</dt>
                  <dd className="text-navy">{formatRange(t.startDate, t.endDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Duración</dt>
                  <dd className="text-navy">{formatDuration(t.durationValue, t.durationUnit)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nivel</dt>
                  <dd className="text-navy">{levelLabel(t.level)}</dd>
                </div>
              </dl>

              {canWrite && t.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{t.notes}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {t.hasCertificate && (
                  <button type="button" onClick={() => download(t)} className="font-semibold text-black hover:underline">
                    Descargar Certificado
                  </button>
                )}
                {canWrite && (
                  <>
                    <button type="button" onClick={() => setEditing(t)} className="font-medium text-slate-600 hover:text-navy">Editar</button>
                    <button type="button" onClick={() => setDeleting(t)} className="font-medium text-red-600 hover:underline">Eliminar</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {props.mode === 'rrhh' && editing && (
        <TrainingDialog
          employeeId={props.employeeId}
          training={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">Eliminar Capacitación</h2>
            <p className="mt-3 text-sm text-slate-600">
              ¿Eliminar <strong>{deleting.name}</strong>? Dejará de verse en el expediente y en Mi Información del colaborador.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">
                Cancelar
              </button>
              <button type="button" onClick={confirmDelete} disabled={busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
