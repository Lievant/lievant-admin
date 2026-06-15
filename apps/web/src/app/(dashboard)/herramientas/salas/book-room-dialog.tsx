'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CreateBookingPayload, Room } from '@/lib/api';
import { AlertIcon, CloseIcon } from '@/components/icons';
import { createBookingAction } from './actions';
import {
  DURATION_OPTIONS,
  WEEKDAYS,
  addHoursToIso,
  buildIsoDateTime,
  formatTimeLabel,
  generateTimeSlots,
} from './constants';
import { SelectField, TextAreaField, TextField } from './form-field';

interface BookRoomDialogProps {
  room: Room;
  officeName: string;
  date: string;
  startTime: string;
  durationHours: number;
  onClose: () => void;
}

const TIME_SLOTS = generateTimeSlots();

function maxRecurrenceEndDate(date: string): string {
  const max = new Date(`${date}T00:00:00Z`);
  max.setUTCMonth(max.getUTCMonth() + 3);
  return max.toISOString().slice(0, 10);
}

export function BookRoomDialog({ room, officeName, date: initialDate, startTime: initialStartTime, durationHours: initialDurationHours, onClose }: BookRoomDialogProps) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [durationHours, setDurationHours] = useState(initialDurationHours);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const startISO = buildIsoDateTime(date, startTime);
  const endISO = addHoursToIso(startISO, durationHours);
  const maxRecurrenceDate = maxRecurrenceEndDate(date);
  const requiresApproval = durationHours > room.requiresApprovalOverHours;

  function toggleDay(rrule: string) {
    setSelectedDays((prev) => (prev.includes(rrule) ? prev.filter((d) => d !== rrule) : [...prev, rrule]));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El motivo o título es obligatorio.');
      return;
    }

    if (isRecurring && selectedDays.length === 0) {
      setError('Selecciona al menos un día para la recurrencia.');
      return;
    }

    if (isRecurring && !recurrenceEndDate) {
      setError('Selecciona la fecha de fin de la recurrencia.');
      return;
    }

    startTransition(async () => {
      const payload: CreateBookingPayload = {
        room_id: room.id,
        title: title.trim(),
        start_time: startISO,
        end_time: endISO,
      };
      if (notes.trim()) payload.notes = notes.trim();
      if (isRecurring) {
        payload.is_recurring = true;
        payload.recurrence_rule = `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')}`;
        payload.recurrence_end_date = recurrenceEndDate;
      }

      const result = await createBookingAction(payload);
      if (result.success) {
        router.refresh();
        onClose();
      } else {
        setError(result.error ?? 'No se pudo crear la reserva.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Reservar {room.name}</h2>
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
          <div className="grid grid-cols-2 gap-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Oficina</p>
              <p className="mt-0.5 font-medium text-navy">{officeName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capacidad</p>
              <p className="mt-0.5 font-medium text-navy">{room.capacity} personas</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TextField id="booking-date" label="Fecha" type="date" value={date} onChange={setDate} />

            <SelectField id="booking-start-time" label="Hora inicio" value={startTime} onChange={setStartTime}>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="booking-duration"
              label="Duración"
              value={String(durationHours)}
              onChange={(value) => setDurationHours(Number(value))}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </div>

          <p className="text-sm text-slate-500">
            Horario: {formatTimeLabel(startISO)} - {formatTimeLabel(endISO)}
          </p>

          <TextField id="booking-title" label="Motivo o título" value={title} onChange={setTitle} maxLength={255} />

          <TextAreaField id="booking-notes" label="Notas (opcional)" value={notes} onChange={setNotes} />

          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <label htmlFor="booking-recurring" className="text-sm font-medium text-navy">
              Reserva recurrente
            </label>
            <button
              type="button"
              id="booking-recurring"
              role="switch"
              aria-checked={isRecurring}
              onClick={() => setIsRecurring((prev) => !prev)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isRecurring ? 'bg-terracota' : 'bg-slate-200'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  isRecurring ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {isRecurring && (
            <div className="space-y-3 rounded-md border border-slate-200 px-3 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días de la semana</p>
                <div className="mt-2 flex gap-2">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.rrule}
                      type="button"
                      onClick={() => toggleDay(day.rrule)}
                      className={`h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                        selectedDays.includes(day.rrule)
                          ? 'bg-terracota text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <TextField
                id="booking-recurrence-end"
                label="Repetir hasta"
                type="date"
                value={recurrenceEndDate}
                onChange={setRecurrenceEndDate}
                min={date}
                max={maxRecurrenceDate}
              />
            </div>
          )}

          {requiresApproval && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Esta reserva requiere aprobación del administrador.</span>
            </div>
          )}

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
              {isPending ? 'Reservando…' : 'Confirmar reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
