'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Booking, BookingAttendee, CreateBookingPayload, Room, UpdateBookingPayload } from '@/lib/api';
import { AlertIcon, CheckIcon, CloseIcon } from '@/components/icons';
import { AttendeesPicker, type AttendeePickerHandle } from '@/components/ui/attendees-picker';
import { createBookingAction, listRoomsByOfficeAction, updateBookingAction } from './actions';
import {
  MAX_BOOKING_MINUTES,
  MIN_BOOKING_MINUTES,
  WEEKDAYS,
  buildIsoDateTime,
  defaultEndTime,
  formatTimeLabel,
  generateTimeOptions,
  timeToMinutes,
} from './constants';
import { SelectField, TextAreaField, TextField } from './form-field';

interface BookRoomDialogProps {
  room: Room;
  officeName: string;
  date: string;
  startTime: string;
  /** Solo se usa para proponer la hora de fin inicial; el formulario envía end_time. */
  durationHours: number;
  booking?: Booking; // presente → modo edición
  onClose: () => void;
}

const TIME_OPTIONS = generateTimeOptions();

function maxRecurrenceEndDate(date: string): string {
  const max = new Date(`${date}T00:00:00Z`);
  max.setUTCMonth(max.getUTCMonth() + 3);
  return max.toISOString().slice(0, 10);
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function BookRoomDialog({
  room,
  officeName,
  date: initialDate,
  startTime: initialStartTime,
  durationHours: initialDurationHours,
  booking,
  onClose,
}: BookRoomDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(booking);
  const pickerRef = useRef<AttendeePickerHandle>(null);

  const [date, setDate] = useState(booking ? booking.startTime.slice(0, 10) : initialDate);
  const [startTime, setStartTime] = useState(booking ? booking.startTime.slice(11, 16) : initialStartTime);
  const [endTime, setEndTime] = useState(
    booking
      ? booking.endTime.slice(11, 16)
      : defaultEndTime(initialStartTime, initialDurationHours, TIME_OPTIONS),
  );
  const [title, setTitle] = useState(booking?.title ?? '');
  const [notes, setNotes] = useState(booking?.notes ?? '');
  const [attendees, setAttendees] = useState<BookingAttendee[]>(booking?.attendees ?? []);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Cambio de sala: solo en edición. Al crear, la sala ya la eligió el usuario
  // en la pantalla anterior y el diálogo se abre sobre ella.
  const [roomId, setRoomId] = useState(booking?.roomId ?? room.id);
  const [officeRooms, setOfficeRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (!isEdit) return;
    let vigente = true;
    void (async () => {
      // Se filtra por la oficina de la reserva: mover una reserva a otra sede
      // cambiaría su zona horaria y el backend lo rechaza.
      const rooms = await listRoomsByOfficeAction(room.officeId);
      if (vigente && rooms) setOfficeRooms(rooms.filter((r) => r.isActive || r.id === room.id));
    })();
    return () => {
      vigente = false;
    };
  }, [isEdit, room.officeId, room.id]);

  /** La sala elegida; hasta que cargue el listado, la original. */
  const selectedRoom = officeRooms.find((r) => r.id === roomId) ?? room;

  const startISO = buildIsoDateTime(date, startTime);
  const endISO = buildIsoDateTime(date, endTime);
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  const maxRecurrenceDate = maxRecurrenceEndDate(date);
  const requiresApproval = durationMinutes / 60 > selectedRoom.requiresApprovalOverHours;

  /** Devuelve el mensaje de error de horario, o null si es válido. */
  function validateRange(): string | null {
    if (durationMinutes <= 0) {
      return 'La hora de finalización debe ser posterior a la hora de inicio.';
    }
    if (durationMinutes < MIN_BOOKING_MINUTES) {
      return `La reserva debe durar al menos ${MIN_BOOKING_MINUTES} minutos.`;
    }
    if (durationMinutes > MAX_BOOKING_MINUTES) {
      return `La reserva no puede exceder ${MAX_BOOKING_MINUTES / 60} horas.`;
    }
    return null;
  }

  const rangeError = validateRange();

  function toggleDay(rrule: string) {
    setSelectedDays((prev) => (prev.includes(rrule) ? prev.filter((d) => d !== rrule) : [...prev, rrule]));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Flush del email escrito pero no confirmado (sin Enter) antes de armar el payload.
    const finalAttendees = pickerRef.current?.commitPending() ?? attendees;

    if (!title.trim()) {
      setError('El motivo o título es obligatorio.');
      return;
    }
    const invalidRange = validateRange();
    if (invalidRange) {
      setError(invalidRange);
      return;
    }
    if (!isEdit && isRecurring && selectedDays.length === 0) {
      setError('Selecciona al menos un día para la recurrencia.');
      return;
    }
    if (!isEdit && isRecurring && !recurrenceEndDate) {
      setError('Selecciona la fecha de fin de la recurrencia.');
      return;
    }

    startTransition(async () => {
      if (isEdit && booking) {
        const payload: UpdateBookingPayload = {
          title: title.trim(),
          start_time: startISO,
          end_time: endISO,
          notes: notes.trim(),
          attendees: finalAttendees,
          // Solo viaja si cambió: el backend revalida solapamiento al recibirlo.
          ...(roomId !== booking.roomId ? { room_id: roomId } : {}),
        };
        const result = await updateBookingAction(booking.id, payload);
        if (result.success) {
          router.refresh();
          onClose();
        } else {
          setError(result.error ?? 'No se pudo actualizar la reserva.');
        }
        return;
      }

      const payload: CreateBookingPayload = {
        room_id: room.id,
        title: title.trim(),
        start_time: startISO,
        end_time: endISO,
      };
      if (notes.trim()) payload.notes = notes.trim();
      if (finalAttendees.length > 0) payload.attendees = finalAttendees;
      if (isRecurring) {
        payload.is_recurring = true;
        payload.recurrence_rule = `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')}`;
        payload.recurrence_end_date = recurrenceEndDate;
      }

      const result = await createBookingAction(payload);
      if (result.success) {
        // Ajuste 2: pantalla de éxito + redirección a Mis reservas.
        setSuccess(true);
        setTimeout(() => {
          router.push('/herramientas/salas/mis-reservas');
        }, 1200);
      } else {
        setError(result.error ?? 'No se pudo crear la reserva.');
      }
    });
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckIcon className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-navy">¡Reserva confirmada!</h2>
          <p className="mt-1 text-sm text-slate-500">Redirigiendo a Mis reservas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">
            {isEdit ? 'Modificar reserva' : `Reservar ${room.name}`}
          </h2>
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
          {isEdit && (
            <SelectField id="booking-room" label="Sala" value={roomId} onChange={setRoomId}>
              {/* Mientras carga el listado se muestra al menos la sala actual,
                  para que el select nunca aparezca vacío. */}
              {(officeRooms.length > 0 ? officeRooms : [room]).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.capacity} personas
                </option>
              ))}
            </SelectField>
          )}

          <div className="grid grid-cols-2 gap-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Oficina</p>
              <p className="mt-0.5 font-medium text-navy">{officeName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capacidad</p>
              <p className="mt-0.5 font-medium text-navy">{selectedRoom.capacity} personas</p>
            </div>
            {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Amenidades
                </p>
                <p className="mt-0.5 text-navy">{selectedRoom.amenities.join(' · ')}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <TextField id="booking-date" label="Fecha" type="date" value={date} onChange={setDate} />

            <SelectField id="booking-start-time" label="Hora inicio" value={startTime} onChange={setStartTime}>
              {TIME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="booking-end-time"
              label="Hora de finalización"
              value={endTime}
              onChange={setEndTime}
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectField>
          </div>

          <p className="text-sm text-slate-500">
            Horario: {formatTimeLabel(startISO)} - {formatTimeLabel(endISO)}
            {durationMinutes > 0 && ` · ${formatMinutes(durationMinutes)}`}
          </p>

          {rangeError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {rangeError}
            </div>
          )}

          <TextField id="booking-title" label="Motivo o título" value={title} onChange={setTitle} maxLength={255} />

          <TextAreaField id="booking-notes" label="Notas (opcional)" value={notes} onChange={setNotes} />

          <AttendeesPicker ref={pickerRef} id="booking-attendees" value={attendees} onChange={setAttendees} />

          {!isEdit && (
            <>
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
                  className={`relative h-6 w-11 rounded-full transition-colors ${isRecurring ? 'bg-black' : 'bg-slate-200'}`}
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
                              ? 'bg-black text-white'
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
            </>
          )}

          {requiresApproval && !isEdit && (
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
              disabled={isPending || rangeError !== null}
              className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending
                ? isEdit
                  ? 'Guardando…'
                  : 'Reservando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Confirmar reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
