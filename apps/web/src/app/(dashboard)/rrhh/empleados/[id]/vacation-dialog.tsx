'use client';

import { useState, useTransition } from 'react';
import type { CreateVacationPayload, EmployeeDetail, EmployeeVacation } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import { TextField } from '../form-field';
import { createVacationAction, updateVacationAction } from './actions';

export function VacationDialog({
  employee,
  vacation,
  existingYears,
  onClose,
}: {
  employee: EmployeeDetail;
  vacation?: EmployeeVacation;
  existingYears: number[];
  onClose: () => void;
}) {
  const isEdit = Boolean(vacation);
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(vacation ? String(vacation.year) : String(currentYear));
  const [openingBalance, setOpeningBalance] = useState(vacation?.openingBalance ?? '');
  const [taken, setTaken] = useState(vacation?.taken ?? '');
  const [supportActivityDays, setSupportActivityDays] = useState(vacation?.supportActivityDays ?? '');
  const [notes, setNotes] = useState(vacation?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const yearNum = Number(year);
    if (!yearNum) {
      setError('El año es obligatorio.');
      return;
    }
    if (!isEdit && existingYears.includes(yearNum)) {
      setError(`Ya existe un registro de vacaciones para el año ${yearNum}.`);
      return;
    }

    startTransition(async () => {
      const payload: CreateVacationPayload = { year: yearNum };
      if (openingBalance !== '') payload.openingBalance = Number(openingBalance);
      if (taken !== '') payload.taken = Number(taken);
      if (supportActivityDays !== '') payload.supportActivityDays = Number(supportActivityDays);
      if (notes.trim()) payload.notes = notes.trim();

      const result =
        isEdit && vacation
          ? await updateVacationAction(employee.id, vacation.id, payload)
          : await createVacationAction(employee.id, payload);

      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? 'No se pudo guardar el movimiento de vacaciones.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">{isEdit ? 'Editar movimiento' : 'Registrar movimiento'}</h2>
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
          <TextField id="vacation-year" label="Año" type="number" value={year} onChange={setYear} />

          <div className="grid grid-cols-2 gap-4">
            <TextField id="vacation-opening" label="Días de apertura" type="number" value={openingBalance} onChange={setOpeningBalance} />
            <TextField id="vacation-taken" label="Días tomados" type="number" value={taken} onChange={setTaken} />
          </div>

          <TextField id="vacation-support" label="Días de actividad de apoyo" type="number" value={supportActivityDays} onChange={setSupportActivityDays} />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="vacation-notes">
              Notas
            </label>
            <textarea
              id="vacation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota"
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
              className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
