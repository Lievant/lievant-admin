'use client';

import { useState } from 'react';
import { ModalShell } from './modal-shell';
import { usePermission } from '@/hooks/use-permission';
import { ReportsToPicker } from './reports-to-picker';
import { areasForDivision, inList, levelOptionLabel, requiredErrors, type PositionDetail, type PositionOptions, type ReportsToValue } from './positions-constants';

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!body?.message) return res.status === 403 ? 'No tienes permiso para esta acción.' : fallback;
  return Array.isArray(body.message) ? body.message.join(' ') : body.message;
}

function TextField({ id, label, value, onChange, max, list, rows, required, error }: { id: string; label: string; value: string; onChange: (v: string) => void; max: number; list?: string; rows?: number; required?: boolean; error?: string | undefined }) {
  const cls = `${INPUT}${error ? ' border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={LABEL}>{label}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</label>
      {rows ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} aria-required={required} aria-invalid={Boolean(error)} className={cls} />
      ) : (
        <input id={id} list={list} value={value} onChange={(e) => onChange(e.target.value)} maxLength={max} aria-required={required} aria-invalid={Boolean(error)} className={cls} />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
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
  options: PositionOptions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(position?.title ?? '');
  const [division, setDivision] = useState(() => {
    const current = position?.division ?? '';
    return options.divisions.find((d) => inList([d], current)) ?? current;
  });
  const [area, setArea] = useState(position?.area ?? '');
  const [level, setLevel] = useState(position?.level ?? '');
  const [seniority, setSeniority] = useState(position?.seniority ?? '');
  // Áreas agregadas al catálogo desde este formulario (se suman a las del catálogo hasta recargar).
  const [addedAreas, setAddedAreas] = useState<{ name: string; division: string | null }[]>([]);
  const [newArea, setNewArea] = useState<string | null>(null);
  const [areaMsg, setAreaMsg] = useState<{ text: string; suggestion?: string } | null>(null);
  const [areaBusy, setAreaBusy] = useState(false);
  const canAddArea = usePermission('rrhh', 'matriz-puestos', 'update');
  const [meot, setMeot] = useState(position?.meotHierarchy ?? '');
  const [reportsToEmployee, setReportsToEmployee] = useState<ReportsToValue | null>(position?.reportsToEmployee ?? null);
  const [submitted, setSubmitted] = useState(false);
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
    if (!area.trim()) return setError('Elige el área de la lista.');
    if (title.trim().length > 200) return setError('El puesto no puede pasar de 200 caracteres.');
    if (description.length > 10000) return setError('La descripción no puede pasar de 10,000 caracteres.');
    const n = plazas.trim() === '' ? null : Number(plazas);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return setError('Las plazas deben ser un número entero de 0 o más.');
    setSubmitted(true);
    const missing = requiredErrors({ roleSummary, positionObjective: objective, validationPoints: points, description });
    if (Object.keys(missing).length > 0) return setError('Completa los campos obligatorios (marcados con *).');

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        area: area.trim(),
        division: division.trim() || null,
        level: level.trim() || null,
        seniority: seniority || null,
        meotHierarchy: meot.trim() || null,
        reportsToEmployeeId: reportsToEmployee?.id ?? null,
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

  const levelCodes = options.levels.map((l) => l.code);
  const areaOptions = areasForDivision([...options.catalogAreas, ...addedAreas], division);
  // Un valor antiguo fuera de catálogo se ofrece para no perderlo al editar otros campos.
  const legacyLevel = level !== '' && !inList(levelCodes, level) ? level : null;
  // Una división antigua fuera del catálogo se ofrece para no perderla al editar otros campos.
  const legacyDivision = division !== '' && !inList(options.divisions, division) ? division : null;
  const legacyArea = area !== '' && !inList(areaOptions, area) ? area : null;

  const changeDivision = (value: string) => {
    setDivision(value);
    // El área depende de la división: si la que estaba ya no pertenece a la nueva, se limpia.
    if (area && !inList(areasForDivision([...options.catalogAreas, ...addedAreas], value), area)) setArea('');
  };

  const addArea = async (confirmSimilar = false) => {
    const name = (newArea ?? '').trim();
    if (!name) return setAreaMsg({ text: 'Escribe el nombre del área.' });
    if (!division.trim()) return setAreaMsg({ text: 'Primero captura la división: las áreas se agregan por división.' });
    setAreaBusy(true);
    setAreaMsg(null);
    try {
      const res = await fetch('/api/hr/job-position-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division: division.trim(), name, confirmSimilar }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as { message?: string; suggestion?: string } | null;
        return setAreaMsg({ text: body?.message ?? 'Ya existe un área parecida.', ...(body?.suggestion ? { suggestion: body.suggestion } : {}) });
      }
      if (!res.ok) throw new Error(await readError(res, 'No se pudo agregar el área.'));
      const body = (await res.json()) as { created: boolean; area: { name: string; division: string } };
      setAddedAreas((a) => [...a, { name: body.area.name, division: body.area.division }]);
      setArea(body.area.name);
      setNewArea(null);
      setAreaMsg(body.created ? null : { text: `Ya existía «${body.area.name}»; se usó esa.` });
    } catch (err) {
      setAreaMsg({ text: err instanceof Error ? err.message : 'No se pudo agregar el área.' });
    } finally {
      setAreaBusy(false);
    }
  };

  // Los mensajes aparecen al intentar guardar y se quitan al llenar el campo.
  const errors = submitted ? requiredErrors({ roleSummary, positionObjective: objective, validationPoints: points, description }) : {};

  const approvedWarning = Boolean(position?.descriptionApproved) && description.trim() !== (position?.description ?? '');

  return (
    <ModalShell
      title={position ? 'Editar Puesto' : 'Nuevo Puesto'}
      onClose={onClose}
      onSubmit={submit}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
        <div className="space-y-4">
          {position && (
            <p className="text-sm text-slate-500">
              Código: <span className="font-mono font-semibold text-navy">{position.code}</span> (lo asigna el sistema)
            </p>
          )}
          <TextField id="jp-title" label="Puesto" value={title} onChange={setTitle} max={200} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-division" className={LABEL}>División (Opcional)</label>
              <select id="jp-division" value={division} onChange={(e) => changeDivision(e.target.value)} className={INPUT}>
                <option value="">Sin división</option>
                {legacyDivision && <option value={legacyDivision}>{legacyDivision} (Fuera de Catálogo)</option>}
                {options.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <p className="text-xs text-slate-400">Las divisiones se administran en Configuración › Catálogos.</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-area" className={LABEL}>Área</label>
              <select
                id="jp-area"
                value={area}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setNewArea(''); setAreaMsg(null); } else { setArea(e.target.value); setNewArea(null); }
                }}
                className={INPUT}
              >
                <option value="">Selecciona…</option>
                {legacyArea && <option value={legacyArea}>{legacyArea} (Fuera de Catálogo)</option>}
                {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                {canAddArea && <option value="__new__">+ Agregar área nueva…</option>}
              </select>
              {newArea !== null && (
                <div className="mt-1 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                  <input aria-label="Nombre del área nueva" value={newArea} onChange={(e) => setNewArea(e.target.value)} maxLength={100} placeholder="Nombre del área nueva" className={INPUT} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={areaBusy} onClick={() => void addArea(false)} className="rounded-md bg-black px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">{areaBusy ? 'Agregando…' : 'Agregar al Catálogo'}</button>
                    <button type="button" onClick={() => { setNewArea(null); setAreaMsg(null); }} className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">Cancelar</button>
                  </div>
                </div>
              )}
              {areaMsg && (
                <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <p>{areaMsg.text}</p>
                  {areaMsg.suggestion && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setArea(areaMsg.suggestion as string); setNewArea(null); setAreaMsg(null); }} className="rounded-md bg-black px-2 py-1 font-semibold text-white">Usar «{areaMsg.suggestion}»</button>
                      <button type="button" disabled={areaBusy} onClick={() => void addArea(true)} className="rounded-md border border-amber-300 px-2 py-1 font-medium">Crear de Todos Modos</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-level" className={LABEL}>Nivel (Opcional)</label>
              <select id="jp-level" value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT}>
                <option value="">Sin nivel</option>
                {legacyLevel && <option value={legacyLevel}>{legacyLevel} (Fuera de Catálogo)</option>}
                {options.levels.map((l) => <option key={l.code} value={l.code}>{levelOptionLabel(l)}</option>)}
              </select>
              {position?.levelOriginal && (
                <p className="text-xs text-slate-400">Nivel original (Excel): {position.levelOriginal}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="jp-seniority" className={LABEL}>Categoría (Opcional)</label>
              <select id="jp-seniority" value={seniority} onChange={(e) => setSeniority(e.target.value)} className={INPUT}>
                <option value="">Sin categoría</option>
                {options.seniorities.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <TextField id="jp-meot" label="Jerarquía (MEOT) (Opcional)" value={meot} onChange={setMeot} max={100} />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="jp-reports" className={LABEL}>Reporta a (Opcional)</label>
              <ReportsToPicker id="jp-reports" value={reportsToEmployee} onChange={setReportsToEmployee} />
              {position?.reportsTo && !reportsToEmployee && <p className="text-xs text-slate-400">En el Excel venía: {position.reportsTo}</p>}
            </div>
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
          <TextField id="jp-role" label="Rol" required error={errors.roleSummary} value={roleSummary} onChange={setRoleSummary} max={10000} rows={3} />
          <TextField id="jp-objective" label="Objetivo del Puesto" required error={errors.positionObjective} value={objective} onChange={setObjective} max={10000} rows={3} />
          <TextField id="jp-points" label="Puntos a Validar" required error={errors.validationPoints} value={points} onChange={setPoints} max={10000} rows={3} />
          <div className="flex flex-col gap-1">
            <label htmlFor="jp-desc" className={LABEL}>Descripción del Puesto<span className="ml-0.5 text-red-600" aria-hidden="true">*</span></label>
            <textarea id="jp-desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} aria-required aria-invalid={Boolean(errors.description)} className={`${INPUT}${errors.description ? ' border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`} />
            {errors.description && <p className="text-xs text-red-600">{errors.description}</p>}
            <p className="text-xs text-slate-400">Una descripción nueva o modificada queda Pendiente de Aprobación.</p>
            {approvedWarning && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Al cambiar el texto se invalida la aprobación actual y el puesto vuelve a Pendiente Aprobación.
              </p>
            )}
          </div>

          {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        </div>
    </ModalShell>
  );
}
