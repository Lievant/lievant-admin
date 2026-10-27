'use client';

import { useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { UploadProgress } from '@/components/upload-progress';
import { MAX_UPLOAD_LABEL, uploadToPresignedUrl, validateUploadSize, type UploadedFileRef } from '@/lib/presigned-upload';
import {
  CERTIFICATE_ACCEPT,
  CERTIFICATE_MIME_TYPES,
  DEVELOPMENT_TYPE_OPTIONS,
  DURATION_UNIT_OPTIONS,
  LEVEL_OPTIONS,
  RECOGNITION_LABEL,
  validateTrainingForm,
  type TrainingItem,
} from './training-constants';

const INPUT =
  'rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

/** Alta o edición de una capacitación (RRHH, con permiso de escritura). */
export function TrainingDialog({
  employeeId,
  training,
  onClose,
  onSaved,
}: {
  employeeId: string;
  /** Si viene, es edición. */
  training: TrainingItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(training?.name ?? '');
  const [institution, setInstitution] = useState(training?.institution ?? '');
  const [developmentType, setDevelopmentType] = useState<string>(training?.developmentType ?? '');
  const [level, setLevel] = useState<string>(training?.level ?? '');
  const [startDate, setStartDate] = useState(training?.startDate ?? '');
  const [endDate, setEndDate] = useState(training?.endDate ?? '');
  const [durationValue, setDurationValue] = useState(training?.durationValue != null ? String(training.durationValue) : '');
  const [durationUnit, setDurationUnit] = useState<string>(training?.durationUnit ?? '');
  const [recognition, setRecognition] = useState(training?.isCompanyRecognition ?? false);
  const [notes, setNotes] = useState(training?.notes ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removeCertificate, setRemoveCertificate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const pickFile = (selected: File | null) => {
    setFile(selected);
    if (!selected) return setError(null);
    if (!CERTIFICATE_MIME_TYPES.includes(selected.type)) return setError('El certificado debe ser PDF, JPEG o PNG.');
    setError(validateUploadSize(selected));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const invalid = validateTrainingForm({ name, institution, developmentType, level, startDate, endDate, durationValue, durationUnit });
    if (invalid) return setError(invalid);
    if (file && !CERTIFICATE_MIME_TYPES.includes(file.type)) return setError('El certificado debe ser PDF, JPEG o PNG.');
    if (file) {
      const sizeError = validateUploadSize(file);
      if (sizeError) return setError(sizeError);
    }

    setSaving(true);
    try {
      let certificate: UploadedFileRef | null | undefined;
      if (file) {
        setProgress(0);
        certificate = await uploadToPresignedUrl(`/api/employees/${employeeId}/trainings/certificate-upload`, file, setProgress);
      } else if (removeCertificate) {
        certificate = null;
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        institution: institution.trim(),
        developmentType,
        level: level || null,
        startDate,
        endDate: endDate || null,
        durationValue: durationValue.trim() ? Number(durationValue) : null,
        durationUnit: durationUnit || null,
        isCompanyRecognition: recognition,
        notes: notes.trim() || null,
      };
      if (certificate !== undefined) payload.certificate = certificate;

      const res = await fetch(
        training ? `/api/employees/${employeeId}/trainings/${training.id}` : `/api/employees/${employeeId}/trainings`,
        { method: training ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body?.message.join(' ') : body?.message;
        throw new Error(message || 'No se pudo guardar la capacitación.');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la capacitación.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 px-4 py-6 sm:items-center">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-navy">{training ? 'Editar Capacitación' : 'Agregar Capacitación'}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="tr-name">Nombre del Curso o Certificado</label>
            <input id="tr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={300} className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="tr-inst">Institución</label>
            <input id="tr-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} maxLength={200} className={INPUT} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="tr-type">Tipo de Desarrollo</label>
              <select id="tr-type" value={developmentType} onChange={(e) => setDevelopmentType(e.target.value)} className={INPUT}>
                <option value="">Selecciona…</option>
                {DEVELOPMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="tr-level">Nivel (Opcional)</label>
              <select id="tr-level" value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT}>
                <option value="">Sin nivel</option>
                {LEVEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="tr-start">Fecha de Inicio</label>
              <input id="tr-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="tr-end">Fecha de Fin (Vacío = En Curso)</label>
              <input id="tr-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="tr-dur">Duración (Opcional)</label>
              <input id="tr-dur" type="number" min={1} step={1} inputMode="numeric" value={durationValue} onChange={(e) => setDurationValue(e.target.value)} className={INPUT} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="tr-unit">Unidad</label>
              <select id="tr-unit" value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} className={INPUT}>
                <option value="">Sin unidad</option>
                {DURATION_UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={recognition} onChange={(e) => setRecognition(e.target.checked)} className="mt-0.5" />
            {RECOGNITION_LABEL}
          </label>

          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="tr-file">Certificado (Opcional)</label>
            {training?.hasCertificate && !removeCertificate && !file && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                Actual: {training.certificateOriginalName ?? 'Certificado'}
                <button type="button" onClick={() => setRemoveCertificate(true)} className="text-xs font-semibold text-red-600 hover:underline">
                  Quitar
                </button>
              </p>
            )}
            {removeCertificate && !file && (
              <p className="text-sm text-slate-500">
                Se quitará el certificado al guardar.{' '}
                <button type="button" onClick={() => setRemoveCertificate(false)} className="text-xs font-semibold text-black hover:underline">Deshacer</button>
              </p>
            )}
            <input
              id="tr-file"
              type="file"
              accept={CERTIFICATE_ACCEPT}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-600 hover:file:bg-slate-200"
            />
            <p className="text-xs text-slate-400">PDF, JPEG o PNG · Máximo {MAX_UPLOAD_LABEL}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="tr-notes">Notas (Opcional)</label>
            <textarea id="tr-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT} />
          </div>

          {progress !== null && <UploadProgress percent={progress} />}
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
