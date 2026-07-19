'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MyVacationBalance, VacationHoliday } from '@/lib/api';
import { ChevronLeftIcon, PlaneIcon } from '@/components/icons';
import { EmployeePicker, type EmployeePickerValue } from '@/app/(dashboard)/rrhh/empleados/employee-picker';

interface Props {
  balance: MyVacationBalance | null;
}

interface CalcResult {
  workingDays: number;
  excludedHolidays: VacationHoliday[];
}

const inputClass =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota';

export function NewVacationForm({ balance }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [substitute, setSubstitute] = useState<EmployeePickerValue | null>(null);
  const [notes, setNotes] = useState('');

  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const available = balance?.balance?.availableDays ?? 0;

  useEffect(() => {
    if (!startDate || !endDate || endDate < startDate) {
      setCalc(null);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const qs = new URLSearchParams({ startDate, endDate }).toString();
        const res = await fetch(`/api/vacations/calculate-days?${qs}`);
        if (res.ok) {
          setCalc((await res.json()) as CalcResult);
        } else {
          setCalc(null);
        }
      } catch {
        setCalc(null);
      } finally {
        setCalcLoading(false);
      }
    }, 350);
  }, [startDate, endDate]);

  const workingDays = calc?.workingDays ?? 0;
  const remaining = available - workingDays;
  const insufficient = workingDays > available;
  const canSubmit =
    !!startDate && !!endDate && endDate >= startDate && workingDays > 0 && !insufficient && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/vacations/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          substituteEmployeeId: substitute?.id,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        throw new Error(msg ?? 'No se pudo crear la solicitud.');
      }
      router.push('/herramientas/vacaciones');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link
        href="/herramientas/vacaciones"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Mis vacaciones
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracota-bg text-terracota">
          <PlaneIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Herramientas</p>
          <h1 className="text-2xl font-bold text-navy">Solicitar vacaciones</h1>
        </div>
      </div>

      {!balance?.balance ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <PlaneIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-navy">
            Aún no has completado tu primer año de servicio.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Todavía no puedes solicitar vacaciones. Tu saldo se generará al cumplir tu primer aniversario.
          </p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="start" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fecha de inicio
            </label>
            <input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fecha de fin
            </label>
            <input
              id="end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>

        {startDate && endDate && endDate >= startDate && (
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
            {calcLoading ? (
              <span className="text-slate-400">Calculando días hábiles…</span>
            ) : (
              <span className="font-semibold text-navy">
                {workingDays} día{workingDays === 1 ? '' : 's'} hábil{workingDays === 1 ? '' : 'es'}
              </span>
            )}
          </div>
        )}

        <EmployeePicker label="Sustituto (opcional)" value={substitute} onSelect={setSubstitute} id="substitute" />

        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Notas (opcional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Contexto adicional para tu jefe…"
          />
        </div>

        {/* Resumen */}
        {workingDays > 0 && (
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Resumen</p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Días a tomar</dt>
                <dd className="font-semibold text-navy">{workingDays}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Saldo disponible</dt>
                <dd className="font-semibold text-navy">{available}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Saldo restante</dt>
                <dd className={`font-semibold ${insufficient ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {remaining}
                </dd>
              </div>
            </dl>
            {calc && calc.excludedHolidays.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-2">
                <p className="text-xs font-semibold text-slate-400">Festivos excluidos</p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                  {calc.excludedHolidays.map((h) => (
                    <li key={h.id}>
                      {h.date.slice(0, 10)} · {h.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {insufficient && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">
            No tienes saldo suficiente: solicitas {workingDays} y dispones de {available}.
          </p>
        )}
        {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Link
            href="/herramientas/vacaciones"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white transition hover:bg-terracota-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
