'use client';

import { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { Booking, Room } from '@/lib/api';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { getRoomBookingsAction } from '../actions';
import { formatDateLabel } from '../constants';

interface RoomCalendarProps {
  room: Room;
  onSlotClick: (date: string, time: string) => void;
}

const SLOT_MINUTES = 30;
const START_HOUR = 7;
const END_HOUR = 20;

const STATUS_STYLES: Record<string, string> = {
  confirmada: 'bg-blue-100 text-blue-700',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700',
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
}

const SLOTS = buildSlots();

export function RoomCalendar({ room, onSlotClick }: RoomCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tooltip, setTooltip] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  useEffect(() => {
    const dateFrom = toDateString(weekStart);
    const end = new Date(weekStart);
    end.setUTCDate(end.getUTCDate() + 6);
    const dateTo = toDateString(end);

    startTransition(async () => {
      const result = await getRoomBookingsAction(room.id, dateFrom, dateTo);
      setBookings(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, room.id]);

  function changeWeek(offset: number) {
    setTooltip(null);
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setUTCDate(next.getUTCDate() + offset * 7);
      return next;
    });
  }

  function findBooking(day: Date, slot: string): Booking | undefined {
    if (!bookings) return undefined;
    const slotStart = new Date(`${toDateString(day)}T${slot}:00Z`);
    const slotEnd = new Date(slotStart);
    slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + SLOT_MINUTES);

    return bookings.find((booking) => {
      if (booking.status === 'cancelada') return false;
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      return start < slotEnd && end > slotStart;
    });
  }

  function handleCellClick(day: Date, slot: string, booking: Booking | undefined) {
    if (booking) {
      setTooltip(`${booking.title} — Reservada por: ${booking.user?.name ?? 'Desconocido'}`);
      return;
    }
    setTooltip(null);
    onSlotClick(toDateString(day), slot);
  }

  const firstDay = days[0];
  const lastDay = days[6];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeWeek(-1)}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Semana anterior"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold text-navy">
          {firstDay && formatDateLabel(firstDay.toISOString())} - {lastDay && formatDateLabel(lastDay.toISOString())}
        </p>
        <button
          type="button"
          onClick={() => changeWeek(1)}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Semana siguiente"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {bookings === null && !isPending ? (
        <p className="mt-4 text-center text-sm text-slate-400">No tienes permisos para ver el calendario de esta sala.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-8 text-xs">
            <div />
            {days.map((day) => (
              <div key={day.toISOString()} className="border-b border-slate-200 px-1 py-2 text-center font-semibold text-navy">
                {new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric' }).format(day)}
              </div>
            ))}

            {SLOTS.map((slot) => (
              <div key={slot} className="contents">
                <div className="flex items-center justify-end border-b border-slate-100 pr-2 text-slate-400">
                  {slot.endsWith(':00') ? slot : ''}
                </div>
                {days.map((day) => {
                  const booking = findBooking(day, slot);
                  const slotStart = new Date(`${toDateString(day)}T${slot}:00Z`);
                  const isStart = booking && new Date(booking.startTime).getTime() === slotStart.getTime();

                  return (
                    <button
                      key={`${day.toISOString()}-${slot}`}
                      type="button"
                      onClick={() => handleCellClick(day, slot, booking)}
                      className={cn(
                        'h-6 border-b border-l border-slate-100 text-left text-[10px] leading-none',
                        booking ? STATUS_STYLES[booking.status] ?? 'bg-slate-100 text-slate-600' : 'hover:bg-slate-50',
                      )}
                    >
                      {isStart ? <span className="truncate px-1">{booking.title}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {tooltip && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{tooltip}</div>
      )}
    </div>
  );
}
