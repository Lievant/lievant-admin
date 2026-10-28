'use client';

import { useState } from 'react';
import { CloseIcon } from '@/components/icons';
import type { PositionDetail } from './positions-constants';

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!body?.message) return res.status === 403 ? 'No tienes permiso para esta acción.' : fallback;
  return Array.isArray(body.message) ? body.message.join(' ') : body.message;
}

function TextField({ id, label, value, onChange, max, list, rows }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; list?: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {rows ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} className={INPUT} />
      ) : (
        <input id={id} list={list} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} className={INPUT} />
      )}
    </div>
  );
}

/**
 * Alta o edición de un puesto. El código (JP-NNN) no se escribe: lo genera el
 * servidor. Para `status` RRHH solo elige Activo o Inactivo; "Pendiente
 * Aprobación" lo pone el sistema según la descripción. La Unidad de Negocio ya
 * no se captura (el API la sigue aceptando pero la pantalla no la maneja).
 */
export function PositionFormDialog({
  position,
  options,
  onClose,
  onSaved,
}: {
  position: PositionDetail | null;
  options: { areas: string[]; divisions: string[]; levels: string[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(position?.title ?? '');
  const [division, setDivision] = useState(position?.division ?? '');
  const [area, setArea] = useState(position?.area ?? '');
  const [level, setLevel] = useState(position?.level ?? '');
  const [meot, setMeot] = useState(position?.meotHierarchy ?? '');
  const [reportsTo, setReportsTo] = useState(position?.reportsTo ?? '');
  const [supervises, setSupervises] = useState(position?.supervises ?? '');
  const [plazas, setPlazas] = useState(position?.plazas != null ? String(position.plazas) : '');
  const [roleSummary, setRoleSummary] = useState(position?.roleSummary ?? '');
  const [objective, setObjective] = useState(position?.positionObjective ?? '');
  const [points, setPoints] = useState(position?.validationPoints ?? '');
  const [status, setStatus] = useState<'activo' | 'inactivo'>(position?.status === 'inactivo' ? 'inactivo' : 'activo');
  const [description, setDescription] = useState(position?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError('El nombre del puesto es obligatorio.');
    if (!area.trim()) return setError('El área es obligatoria.');
    if (title.trim().length > 200) return setError('El puesto no puede pasar de 200 caracteres.');
    if (description.length > 10000) return setError('La descripción no puede pasar de 10,000 caracteres.');
    const n = plazas.trim() === '' ? null : Number(plazas);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return setError('Las plazas deben ser un número entero de 0 o más.');

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        area: area.trim(),
        division: division.trim() || null,
        level: level.trim() || null,
        meotHierarchy: meot.trim() || null,
        reportsTo: reportsTo.trim() || null,
        supervises: supervises.trim() || null,
        plazas: n,
        roleSummary: roleSummary.trim() || null,
        positionObjective: objective.trim() || null,
        validationPoints: points.trim() || null,
        description: description.trim() || null,
        status,
      };
      const res = await fetch(position ? `/api/hr/job-positions/${position.id}` : '/api/hr/job-positions', {
        method: position ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar el puesto.'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el puesto.');
      setSaving(false);
    }
  };

  const approvedWarning = Boolean(position?.descriptionApproved) && description.trim() !== (position?.description ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 px-4 py-6 sm:items-center">
      <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-navy">{position ? 'Editar Puesto' : 'Nuevo Puesto'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
          {position && (
            <p className="text-sm text-slate-500">
              Código: <span className="font-mono font-semibold text-navy">{position.code}</span> (lo asigna el sistema)
            </p>
          )}
          <TextField id="jp-title" label="Puesto" value={title} onChange={setTitle} max={200} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-division" className={LABEL}>División (Opcional)</label>
              <input id="jp-division" list="jp-divisions" value={division} onChange={(e) => setDivision(e.target.value)} maxLength={100} className={INPUT} />
              <datalist id="jp-divisions">{options.divisions.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-area" className={LABEL}>Área</label>
              <input id="jp-area" list="jp-areas" value={area} onChange={(e) => setArea(e.target.value)} maxLength={100} className={INPUT} />
              <datalist id="jp-areas">{options.areas.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-level" className={LABEL}>Nivel (Opcional)</label>
              <input id="jp-level" list="jp-levels" value={level} onChange={(e) => setLevel(e.target.value)} maxLength={50} className={INPUT} />
              <datalist id="jp-levels">{options.levels.map((a) => <option key={a} value={a} />)}</datalist>
            </div>
            <TextField id="jp-meot" label="Jerarquía (MEOT) (Opcional)" value={meot} onChange={setMeot} max={100} />
            <TextField id="jp-reports" label="Reporta a (Opcional)" value={reportsTo} onChange={setReportsTo} max={500} />
            <TextField id="jp-supervises" label="Supervisa a (Opcional)" value={supervises} onChange={setSupervises} max={500} />
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-plazas" className={LABEL}>Plazas (Opcional; 0 = Vacante)</label>
              <input id="jp-plazas" type="number" min={0} step={1} inputMode="numeric" value={plazas} onChange={(e) => setPlazas(e.target.value)} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-status" className={LABEL}>Estado</label>
              <select id="jp-status" value={status} onChange={(e) => setStatus(e.target.value as 'activo' | 'inactivo')} className={INPUT}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <TextField id="jp-role" label="Rol (Opcional)" value={roleSummary} onChange={setRoleSummary} max={10000} rows={3} />
          <TextField id="jp-objective" label="Objetivo del Puesto (Opcional)" value={objective} onChange={setObjective} max={10000} rows={3} />
          <TextField id="jp-points" label="Puntos a Validar (Opcional)" value={points} onChange={setPoints} max={10000} rows={3} />
          <div className="flex flex-col gap-1">
            <label htmlFor="jp-desc" className={LABEL}>Descripción del Puesto (Opcional)</label>
            <textarea id="jp-desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} className={INPUT} />
            <p className="text-xs text-slate-400">Una descripción nueva o modificada queda Pendiente de Aprobación.</p>
            {approvedWarning && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Al cambiar el texto se invalida la aprobación actual y el puesto vuelve a Pendiente Aprobación.
              </p>
            )}
          </div>

          {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
