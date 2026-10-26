'use client';

import { useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { readError } from './position-form-dialog';
import {
  FREQUENCY_OPTIONS,
  currentYearMx,
  makePeriod,
  parsePeriod,
  yearOptions,
  type KpiItem,
  type OkrItem,
} from './positions-constants';

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 px-4 py-6 sm:items-center">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Actions({ onClose, saving }: { onClose: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}

/** Alta o edición de un OKR. El periodo es un selector (año y semestre), nunca texto libre. */
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
  const initial = parsePeriod(okr?.period ?? defaultPeriod) ?? { year: currentYearMx(), semester: 1 as const };
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
      const payload = { period: makePeriod(year, semester), objective: objective.trim(), keyResult: keyResult.trim(), weight: w, isActive };
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
    <Shell title={okr ? 'Editar OKR' : 'Nuevo OKR'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-year" className={LABEL}>Año</label>
            <select id="okr-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={INPUT}>
              {yearOptions(currentYearMx(), [initial.year]).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="okr-sem" className={LABEL}>Semestre</label>
            <select id="okr-sem" value={semester} onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)} className={INPUT}>
              <option value={1}>Semestre 1 (Ene–Jun)</option>
              <option value={2}>Semestre 2 (Jul–Dic)</option>
            </select>
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
        <Actions onClose={onClose} saving={saving} />
      </form>
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
    <Shell title={kpi ? 'Editar KPI' : 'Nuevo KPI'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
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
        <Actions onClose={onClose} saving={saving} />
      </form>
    </Shell>
  );
}

/** Confirmación de una baja (puesto, OKR o KPI). */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-navy">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
