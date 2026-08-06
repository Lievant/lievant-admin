'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/icons';
import { adminCreateVacationRequestAction } from './actions';

interface Props {
  employeeId: string;
  employeeName: string;
  /** Saldo disponible actual, para avisar antes de que el backend rechace. */
  availableDays: number;
  onClose: () => void;
}

export function AdminVacationRequestDialog({ employeeId, employeeName, availableDays, onClose }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Los días hábiles los calcula el backend: excluye fines de semana según los
  // work_days del colaborador y los festivos activos, que el cliente no conoce.
  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setWorkingDays(null);
      return;
    }
    let activo = true;
    setCalculating(true);
    const qs = new URLSearchParams({ startDate, endDate, employeeId }).toString();
    fetch(`/api/vacations/admin/calculate-days?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('No se pudo calcular los días.'))))
      .then((data: { workingDays?: number }) => {
        if (activo) setWorkingDays(data.workingDays ?? null);
      })
      .catch(() => {
        if (activo) setWorkingDays(null);
      })
      .finally(() => {
        if (activo) setCalculating(false);
      });
    return () => {
      activo = false;
    };
  }, [startDate, endDate, employeeId]);

  const rangoInvalido = Boolean(startDate && endDate && endDate < startDate);
  const excedeSaldo = workingDays !== null && workingDays > availableDays;
  const puedeGuardar =
    Boolean(startDate) && Boolean(endDate) && !rangoInvalido && !calculating && workingDays !== null && workingDays > 0;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await adminCreateVacationRequestAction(employeeId, {
        startDate,
        endDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        autoApprove,
      });
      if (res.success) {
        router.refresh();
        onClose();
      } else {
        setError(res.error ?? 'No se pudo crear la solicitud.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Nueva solicitud de vacaciones</h2>
            <p className="mt-0.5 text-xs text-slate-500">En nombre de {employeeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fecha de inicio
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fecha de fin
              </span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
            {rangoInvalido ? (
              <p className="text-rose-600">La fecha de fin no puede ser anterior a la de inicio.</p>
            ) : calculating ? (
              <p className="text-slate-500">Calculando días hábiles…</p>
            ) : workingDays === null ? (
              <p className="text-slate-500">Elige el rango para calcular los días hábiles.</p>
            ) : (
              <p className="text-navy">
                <span className="font-semibold">{workingDays}</span> día{workingDays === 1 ? '' : 's'} hábil
                {workingDays === 1 ? '' : 'es'}
                <span className="text-slate-500"> (excluye descansos y festivos)</span>
                <span className="ml-2 text-xs text-slate-400">· saldo disponible: {availableDays}</span>
              </p>
            )}
            {excedeSaldo && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                Excede el saldo disponible del colaborador; el sistema rechazará la solicitud.
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Notas</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
              placeholder="Motivo o referencia del registro manual…"
            />
          </label>

          <label className="flex items-start gap-2.5 rounded-md border border-slate-200 px-3 py-2.5">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="mt-0.5 accent-black"
            />
            <span className="text-sm text-navy">
              Aprobar automáticamente
              <span className="block text-xs text-slate-500">
                Se registra como aprobada, sin pasar por el jefe directo.
              </span>
            </span>
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!puedeGuardar || isPending}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isPending ? 'Guardando…' : autoApprove ? 'Crear y aprobar' : 'Crear solicitud'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
