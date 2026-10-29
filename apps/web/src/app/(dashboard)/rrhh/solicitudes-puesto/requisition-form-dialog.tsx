'use client';

import { useEffect, useState } from 'react';
import { ModalShell } from '../matriz-puestos/modal-shell';
import {
  COUNTRY_OPTIONS,
  MODALITY_OPTIONS,
  OTHER_POSITION,
  PRIORITY_OPTIONS,
  TYPE_OPTIONS,
  readApiError,
  toFormValues,
  toPayload,
  todayMx,
  validateForSubmit,
  type FormValues,
  type RequisitionDetail,
} from './requisitions-constants';

export interface PositionOption {
  id: string;
  code: string;
  title: string;
  area: string;
  division: string | null;
}

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

/**
 * Formulario de la solicitud (líder): "Guardar Borrador" no exige nada salvo el
 * tipo; "Enviar a RRHH" valida todo, pide confirmación, guarda y envía.
 */
export function RequisitionFormDialog({
  draft,
  positions,
  defaultArea,
  onClose,
  onDone,
}: {
  draft: RequisitionDetail | null;
  positions: PositionOption[];
  defaultArea: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [v, setV] = useState<FormValues>(() => toFormValues(draft, defaultArea));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const today = todayMx();

  // El área del líder llega de forma asíncrona: solo se rellena si el campo sigue vacío.
  useEffect(() => {
    if (!draft && defaultArea) setV((cur) => (cur.area ? cur : { ...cur, area: defaultArea }));
  }, [defaultArea, draft]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV((cur) => ({ ...cur, [key]: value }));

  /** Guarda (alta o edición) y devuelve el id de la solicitud. */
  const save = async (): Promise<string> => {
    const res = await fetch(draft ? `/api/hr/job-requisitions/my/${draft.id}` : '/api/hr/job-requisitions/my', {
      method: draft ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toPayload(v)),
    });
    if (!res.ok) throw new Error((await readApiError(res, 'No se pudo guardar la solicitud.')).message);
    return ((await res.json()) as { id: string }).id;
  };

  const saveDraft = async () => {
    setError(null);
    if (!v.type) return setError('El tipo de solicitud es obligatorio.');
    setSaving(true);
    try {
      await save();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la solicitud.');
      setSaving(false);
    }
  };

  const askToSend = () => {
    setError(null);
    const invalid = validateForSubmit(v, today);
    if (invalid) return setError(invalid);
    setConfirming(true);
  };

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await save();
      const res = await fetch(`/api/hr/job-requisitions/my/${id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error((await readApiError(res, 'No se pudo enviar la solicitud.')).message);
      onDone();
    } catch (err) {
      setConfirming(false);
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
      setSaving(false);
    }
  };

  return (
    <>
      <ModalShell
        title={draft ? `Editar ${draft.code}` : 'Nueva Solicitud de Puesto'}
        onClose={onClose}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
            <button type="button" onClick={saveDraft} disabled={saving} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-50 disabled:opacity-60">
              {saving && !confirming ? 'Guardando…' : 'Guardar Borrador'}
            </button>
            <button type="button" onClick={askToSend} disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
              Enviar a RRHH
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-type" className={LABEL}>Tipo</label>
              <select id="rq-type" value={v.type} onChange={(e) => set('type', e.target.value)} className={INPUT}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-priority" className={LABEL}>Prioridad</label>
              <select id="rq-priority" value={v.priority} onChange={(e) => set('priority', e.target.value)} className={INPUT}>
                <option value="">Selecciona…</option>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-position" className={LABEL}>Puesto</label>
              <select id="rq-position" value={v.positionChoice} onChange={(e) => set('positionChoice', e.target.value)} className={INPUT}>
                <option value="">Selecciona…</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.title}</option>)}
                <option value={OTHER_POSITION}>Otro (Puesto Nuevo)</option>
              </select>
              {(() => {
                const chosen = positions.find((p) => p.id === v.positionChoice);
                return chosen ? <p className="text-xs text-slate-500">{[chosen.division, chosen.area].filter(Boolean).join(' · ')}</p> : null;
              })()}
            </div>
            {v.positionChoice === OTHER_POSITION ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="rq-title" className={LABEL}>Nombre del Puesto Nuevo</label>
                <input id="rq-title" value={v.positionTitle} onChange={(e) => set('positionTitle', e.target.value)} maxLength={200} className={INPUT} />
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-area" className={LABEL}>Área</label>
              <input id="rq-area" value={v.area} onChange={(e) => set('area', e.target.value)} maxLength={100} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-date" className={LABEL}>Fecha Requerida</label>
              <input id="rq-date" type="date" min={today} value={v.requiredDate} onChange={(e) => set('requiredDate', e.target.value)} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-modality" className={LABEL}>Modalidad</label>
              <select id="rq-modality" value={v.modality} onChange={(e) => set('modality', e.target.value)} className={INPUT}>
                <option value="">Selecciona…</option>
                {MODALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rq-country" className={LABEL}>País</label>
              <select id="rq-country" value={v.country} onChange={(e) => set('country', e.target.value)} className={INPUT}>
                <option value="">Selecciona…</option>
                {COUNTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rq-reason" className={LABEL}>Motivo</label>
            <textarea id="rq-reason" rows={2} value={v.reason} onChange={(e) => set('reason', e.target.value)} maxLength={5000} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rq-just" className={LABEL}>Justificación de Negocio</label>
            <textarea id="rq-just" rows={3} value={v.businessJustification} onChange={(e) => set('businessJustification', e.target.value)} maxLength={5000} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="rq-profile" className={LABEL}>Perfil Básico</label>
            <textarea id="rq-profile" rows={3} value={v.basicProfile} onChange={(e) => set('basicProfile', e.target.value)} maxLength={5000} className={INPUT} />
          </div>
          <p className="text-xs text-slate-400">Para guardar un borrador basta el tipo. Para enviar a RRHH todos los campos son obligatorios.</p>

          {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        </div>
      </ModalShell>

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/40 px-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">Enviar a RRHH</h2>
            <p className="mt-3 text-sm text-slate-600">Al enviar, la solicitud queda en solo lectura y RRHH la revisará. ¿Quieres enviarla?</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={saving} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
              <button type="button" onClick={send} disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
