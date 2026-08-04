'use client';

import { useState, useTransition } from 'react';
import type { EmployeeDetail, UpdateTerminationPayload } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { TextField } from '../form-field';
import { updateTerminationAction } from './actions';

export function TerminationDialog({ employee, onClose }: { employee: EmployeeDetail; onClose: () => void }) {
  const [terminationDate, setTerminationDate] = useState('');
  const [reason, setReason] = useState('');
  const [severancePaid, setSeverancePaid] = useState(false);
  const [severanceAmount, setSeveranceAmount] = useState('');
  const [references, setReferences] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!terminationDate) {
      setError('La fecha de baja es obligatoria.');
      return;
    }

    startTransition(async () => {
      const payload: UpdateTerminationPayload = { terminationDate, severancePaid };
      if (reason.trim()) payload.reason = reason.trim();
      if (severanceAmount !== '') payload.severanceAmount = Number(severanceAmount);
      if (references.trim()) payload.references = references.trim();
      if (notes.trim()) payload.notes = notes.trim();

      const result = await updateTerminationAction(employee.id, payload);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo registrar la baja.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Registrar baja</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Al registrar la baja, el estado del empleado cambiará a Inactivo.
          </div>

          <TextField id="termination-date" label="Fecha de baja" type="date" value={terminationDate} onChange={setTerminationDate} />
          <TextField id="termination-reason" label="Motivo" value={reason} onChange={setReason} placeholder="Renuncia voluntaria, fin de contrato…" />

          <div className="grid grid-cols-2 gap-4">
            <TextField id="termination-severance-amount" label="Monto de finiquito" type="number" value={severanceAmount} onChange={setSeveranceAmount} />
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={severancePaid}
                onChange={(e) => setSeverancePaid(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-black focus:ring-black"
              />
              Finiquito pagado
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="termination-references">
              Referencias
            </label>
            <textarea
              id="termination-references"
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="termination-notes">
              Notas
            </label>
            <textarea
              id="termination-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Registrar baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
