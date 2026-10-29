'use client';

import { useState } from 'react';
import { ModalShell } from './modal-shell';
import { readError } from './position-form-dialog';
import {
  ACTIVITY_FREQUENCY_OPTIONS,
  BASE_PERIOD,
  FREQUENCY_OPTIONS,
  currentYearMx,
  makePeriod,
  parsePeriod,
  yearOptions,
  type ActivityItem,
  type KpiItem,
  type OkrItem,
} from './positions-constants';

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

function Shell({ title, onClose, onSubmit, footer, children }: { title: string; onClose: () => void; onSubmit?: (e: React.FormEvent) => void; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <ModalShell title={title} onClose={onClose} {...(onSubmit ? { onSubmit } : {})} {...(footer ? { footer } : {})}>
      {children}
    </ModalShell>
  );
}

function Actions({ onClose, saving }: { onClose: () => void; saving: boolean }) {
  return (
    <>
      <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </>
  );
}

/**
 * Alta o edición de un OKR. El periodo es un selector: «Plantilla (Sin Periodo)» o año y semestre, nunca texto libre.
 * `defaultPeriod` es el valor del selector de la pantalla ('base' = plantilla).
 */
export function OkrDialog({
  positionId,
  okr,
  defaultPeriod,
  onClose,
  onSaved,
}: {
  positionId: string;
  okr: OkrItem | null;
  defaultPeriod: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const startPeriod = okr ? (okr.period ?? BASE_PERIOD) : defaultPeriod;
  const initial = parsePeriod(startPeriod) ?? { year: currentYearMx(), semester: 1 as const };
  const [isTemplate, setIsTemplate] = useState(startPeriod === BASE_PERIOD);
  const [objectiveCode, setObjectiveCode] = useState(okr?.objectiveCode ?? '');
  const [krCode, setKrCode] = useState(okr?.krCode ?? '');
  const [year, setYear] = useState(initial.year);
  const [semester, setSemester] = useState<1 | 2>(initial.semester);
  const [objective, setObjective] = useState(okr?.objective ?? '');
  const [keyResult, setKeyResult] = useState(okr?.keyResult ?? '');
  const [weight, setWeight] = useState(okr?.weight != null ? String(okr.weight) : '');
  const [isActive, setIsActive] = useState(okr?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!objective.trim()) return setError('El objetivo es obligatorio.');
    if (!keyResult.trim()) return setError('El resultado clave es obligatorio.');
    if (objective.length > 2000 || keyResult.length > 2000) return setError('Los textos no pueden pasar de 2,000 caracteres.');
    const w = weight.trim() === '' ? null : Number(weight);
    if (w !== null && (!Number.isFinite(w) || w < 0 || w > 100)) return setError('El peso debe estar entre 0 y 100.');

    setSaving(true);
    try {
      const payload = {
        period: isTemplate ? null : makePeriod(year, semester),
        objectiveCode: objectiveCode.trim() || null,
        krCode: krCode.trim() || null,
        objective: objective.trim(),
        keyResult: keyResult.trim(),
        weight: w,
        isActive,
      };
      const res = await fetch(okr ? `/api/hr/job-position-okrs/${okr.id}` : `/api/hr/job-positions/${positionId}/okrs`, {
        method: okr ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar el OKR.'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el OKR.');
      setSaving(false);
    }
  };

  return (
    <Shell title={okr ? 'Editar OKR' : 'Nuevo OKR'} onClose={onClose} onSubmit={submit} footer={<Actions onClose={onClose} saving={saving} />}>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} />
          Plantilla (Sin Periodo): vale para cualquier semestre
        </label>
        <div className={`grid grid-cols-2 gap-4 ${isTemplate ? 'opacity-50' : ''}`}>
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-year" className={LABEL}>Año</label>
            <select id="okr-year" value={year} disabled={isTemplate} onChange={(e) => setYear(Number(e.target.value))} className={INPUT}>
              {yearOptions(currentYearMx(), [initial.year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-sem" className={LABEL}>Semestre</label>
            <select id="okr-sem" value={semester} disabled={isTemplate} onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)} className={INPUT}>
              <option value={1}>Semestre 1 (Ene–Jun)</option>
              <option value={2}>Semestre 2 (Jul–Dic)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-ocode" className={LABEL}>Código del Objetivo (Opcional)</label>
            <input id="okr-ocode" value={objectiveCode} onChange={(e) => setObjectiveCode(e.target.value)} maxLength={10} placeholder="O1" className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-krcode" className={LABEL}>Código del Resultado (Opcional)</label>
            <input id="okr-krcode" value={krCode} onChange={(e) => setKrCode(e.target.value)} maxLength={10} placeholder="KR1" className={INPUT} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="okr-obj" className={LABEL}>Objetivo</label>
          <textarea id="okr-obj" rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={2000} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="okr-kr" className={LABEL}>Resultado Clave</label>
          <textarea id="okr-kr" rows={3} value={keyResult} onChange={(e) => setKeyResult(e.target.value)} maxLength={2000} className={INPUT} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-w" className={LABEL}>Peso % (0–100, Opcional)</label>
            <input id="okr-w" type="number" min={0} max={100} step="0.01" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={INPUT} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Activo (cuenta para la suma de pesos)
          </label>
        </div>
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>
    </Shell>
  );
}

export function KpiDialog({
  positionId,
  kpi,
  onClose,
  onSaved,
}: {
  positionId: string;
  kpi: KpiItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kpi?.name ?? '');
  const [description, setDescription] = useState(kpi?.description ?? '');
  const [targetValue, setTargetValue] = useState(kpi?.targetValue ?? '');
  const [frequency, setFrequency] = useState<string>(kpi?.measurementFrequency ?? '');
  const [isActive, setIsActive] = useState(kpi?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('El nombre del KPI es obligatorio.');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        targetValue: targetValue.trim() || null,
        measurementFrequency: frequency || null,
        isActive,
      };
      const res = await fetch(kpi ? `/api/hr/job-position-kpis/${kpi.id}` : `/api/hr/job-positions/${positionId}/kpis`, {
        method: kpi ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar el KPI.'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el KPI.');
      setSaving(false);
    }
  };

  return (
    <Shell title={kpi ? 'Editar KPI' : 'Nuevo KPI'} onClose={onClose} onSubmit={submit} footer={<Actions onClose={onClose} saving={saving} />}>
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="kpi-name" className={LABEL}>Nombre</label>
          <input id="kpi-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="kpi-desc" className={LABEL}>Descripción (Opcional)</label>
          <textarea id="kpi-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className={INPUT} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="kpi-target" className={LABEL}>Meta (Opcional)</label>
            <input id="kpi-target" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} maxLength={100} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="kpi-freq" className={LABEL}>Frecuencia de Medición</label>
            <select id="kpi-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} className={INPUT}>
              <option value="">Sin frecuencia</option>
              {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Activo
        </label>
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>
    </Shell>
  );
}

/** Alta o edición de una actividad (responsabilidad) con su grupo, frecuencia y nota. */
export function ActivityDialog({
  positionId,
  activity,
  defaultGroup,
  onClose,
  onSaved,
}: {
  positionId: string;
  activity: ActivityItem | null;
  defaultGroup: { order: number; title: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groupOrder, setGroupOrder] = useState(String(activity?.groupOrder ?? defaultGroup?.order ?? 1));
  const [groupTitle, setGroupTitle] = useState(activity?.groupTitle ?? defaultGroup?.title ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [frequency, setFrequency] = useState<string>(activity?.frequency ?? '');
  const [note, setNote] = useState(activity?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const order = Number(groupOrder);
    if (!Number.isInteger(order) || order < 1) return setError('El número de grupo debe ser un entero de 1 o más.');
    if (!groupTitle.trim()) return setError('El título del grupo es obligatorio.');
    if (!description.trim()) return setError('La descripción de la actividad es obligatoria.');
    setSaving(true);
    try {
      const payload = { groupOrder: order, groupTitle: groupTitle.trim(), description: description.trim(), frequency: frequency || null, note: note.trim() || null };
      const res = await fetch(activity ? `/api/hr/job-position-activities/${activity.id}` : `/api/hr/job-positions/${positionId}/activities`, {
        method: activity ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, 'No se pudo guardar la actividad.'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la actividad.');
      setSaving(false);
    }
  };

  return (
    <Shell title={activity ? 'Editar Actividad' : 'Nueva Actividad'} onClose={onClose} onSubmit={submit} footer={<Actions onClose={onClose} saving={saving} />}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="act-order" className={LABEL}>Grupo Núm.</label>
            <input id="act-order" type="number" min={1} step={1} value={groupOrder} onChange={(e) => setGroupOrder(e.target.value)} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-3">
            <label htmlFor="act-group" className={LABEL}>Título del Grupo</label>
            <input id="act-group" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} maxLength={300} className={INPUT} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="act-desc" className={LABEL}>Actividad</label>
          <textarea id="act-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className={INPUT} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="act-freq" className={LABEL}>Frecuencia</label>
            <select id="act-freq" value={frequency} onChange={(e) => setFrequency(e.target.value)} className={INPUT}>
              <option value="">Sin frecuencia</option>
              {ACTIVITY_FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="act-note" className={LABEL}>Nota (Opcional)</label>
            <input id="act-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className={INPUT} />
          </div>
        </div>
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      </div>
    </Shell>
  );
}

/** Confirmación de una baja (puesto, OKR, KPI o actividad). */
export function ConfirmDelete({
  title,
  message,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: React.ReactNode;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      title={title}
      role="alertdialog"
      maxWidth="max-w-md"
      footer={
        <>
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Eliminando…' : 'Eliminar'}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </ModalShell>
  );
}
