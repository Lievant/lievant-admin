'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Booking, Office, Room } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { useCurrentUser } from '@/components/user-provider';
import { BookRoomDialog } from '../book-room-dialog';
import { CancelBookingDialog } from '../mis-reservas/cancel-booking-dialog';
import { wallClockTodayString } from '../constants';
import { BookingDetailModal } from './booking-detail-modal';

interface RoomCalendarViewProps {
  rooms: Room[];
  bookings: Booking[];
  offices: Office[];
  officeId: string;
  date: string; // YYYY-MM-DD
}

const START_HOUR = 7;
const END_HOUR = 21;
const SLOT_MIN = 30;
const SLOT_PX = 40;
const NUM_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN; // 28
const TOTAL_PX = NUM_SLOTS * SLOT_PX;

const STATUS_STYLES: Record<string, string> = {
  confirmada: 'bg-blue-100 border-blue-300 text-blue-800',
  pendiente_aprobacion: 'bg-amber-100 border-amber-300 text-amber-800',
};

const DAY_LABEL = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function slotLabel(index: number): string {
  const totalMin = START_HOUR * 60 + index * SLOT_MIN;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

function minutesFromStartOfGrid(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes() - START_HOUR * 60;
}

export function RoomCalendarView({ rooms, bookings, offices, officeId, date }: RoomCalendarViewProps) {
  const router = useRouter();
  const user = useCurrentUser();
  const canManage = hasPermission(user, 'herramientas', 'salas', 'manage');

  const [newBooking, setNewBooking] = useState<{ room: Room; startTime: string } | null>(null);
  const [occupiedMsg, setOccupiedMsg] = useState<string | null>(null);
  // Reserva existente sobre la que se hizo click: alimenta el modal de detalle
  // y, desde ahí, los flujos de edición y cancelación.
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  function navigate(overrides: { date?: string; office_id?: string }) {
    setOccupiedMsg(null);
    const sp = new URLSearchParams();
    sp.set('date', overrides.date ?? date);
    const oid = overrides.office_id ?? officeId;
    if (oid) sp.set('office_id', oid);
    router.push(`/herramientas/salas/calendario?${sp.toString()}`);
  }

  // Reservas del día (no canceladas), agrupadas por sala.
  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (b.status === 'cancelada') continue;
      if (b.startTime.slice(0, 10) !== date) continue;
      if (!map.has(b.roomId)) map.set(b.roomId, []);
      map.get(b.roomId)!.push(b);
    }
    return map;
  }, [bookings, date]);

  const officeName = offices.find((o) => o.id === officeId)?.name ?? '';

  // ¿La franja [slotIndex] de una sala se solapa con alguna reserva existente?
  function isSlotOccupied(roomId: string, slotIndex: number): boolean {
    const slotStart = slotIndex * SLOT_MIN;
    const slotEnd = slotStart + SLOT_MIN;
    for (const b of bookingsByRoom.get(roomId) ?? []) {
      const bStart = minutesFromStartOfGrid(b.startTime);
      const bEnd = minutesFromStartOfGrid(b.endTime);
      if (bStart < slotEnd && bEnd > slotStart) return true;
    }
    return false;
  }

  /** Sala de una reserva tomada de las columnas del calendario. */
  function roomOf(booking: Booking): Room | undefined {
    return rooms.find((r) => r.id === booking.roomId);
  }

  function roomNameOf(booking: Booking): string {
    return roomOf(booking)?.name ?? booking.room?.name ?? 'Sala';
  }

  function handleSlotClick(room: Room, slotIndex: number) {
    if (isSlotOccupied(room.id, slotIndex)) {
      setOccupiedMsg('Esta sala ya tiene una reserva en este horario.');
      return;
    }
    setOccupiedMsg(null);
    setNewBooking({ room, startTime: slotLabel(slotIndex) });
  }

  return (
    <div>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Calendario de salas</h1>
          <p className="mt-1 text-sm text-slate-500">Herramientas · Reserva de salas</p>
        </div>
        <Link
          href="/herramientas/salas"
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          ← Buscar salas
        </Link>
      </header>

      {/* Controles */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ date: shiftDate(date, -1) })}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
            aria-label="Día anterior"
          >
            ‹
          </button>
          <button
            type="button"
            // toISOString() da la fecha en UTC: después de las 18:00 en México
            // saltaba al día siguiente. wallClockTodayString usa la hora local.
            onClick={() => navigate({ date: wallClockTodayString() })}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => navigate({ date: shiftDate(date, 1) })}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
            aria-label="Día siguiente"
          >
            ›
          </button>
          <span className="ml-2 text-sm font-semibold capitalize text-navy">
            {DAY_LABEL.format(new Date(`${date}T00:00:00Z`))}
          </span>
        </div>

        <select
          value={officeId}
          onChange={(e) => navigate({ office_id: e.target.value, date })}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
        >
          {offices.length === 0 && <option value="">Sin oficinas</option>}
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100" /> Confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100" /> Pendiente
        </span>
      </div>

      {occupiedMsg && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <span>{occupiedMsg}</span>
          <button
            type="button"
            onClick={() => setOccupiedMsg(null)}
            className="text-amber-600 hover:text-amber-800"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid */}
      {rooms.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          No hay salas para esta oficina.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="min-w-[640px]">
            {/* Header de salas */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              <div className="w-16 shrink-0 border-r border-slate-200 py-2 text-center text-xs font-semibold text-slate-400">
                Hora
              </div>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex-1 border-r border-slate-200 px-2 py-2 text-center text-xs font-semibold text-navy last:border-r-0"
                >
                  {room.name}
                </div>
              ))}
            </div>

            {/* Cuerpo */}
            <div className="flex">
              {/* Columna de horas */}
              <div className="w-16 shrink-0 border-r border-slate-200">
                {Array.from({ length: NUM_SLOTS }, (_, i) => (
                  <div
                    key={i}
                    style={{ height: SLOT_PX }}
                    className="border-b border-slate-100 pr-1 pt-0.5 text-right text-[10px] text-slate-400"
                  >
                    {i % 2 === 0 ? slotLabel(i) : ''}
                  </div>
                ))}
              </div>

              {/* Columnas de salas */}
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="relative flex-1 border-r border-slate-200 last:border-r-0"
                  style={{ height: TOTAL_PX }}
                >
                  {/* Celdas vacías clickeables */}
                  {Array.from({ length: NUM_SLOTS }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSlotClick(room, i)}
                      style={{ height: SLOT_PX }}
                      className="block w-full border-b border-slate-100 hover:bg-black/5"
                      aria-label={`Reservar ${room.name} a las ${slotLabel(i)}`}
                    />
                  ))}

                  {/* Bloques de reservas */}
                  {(bookingsByRoom.get(room.id) ?? []).map((b) => {
                    const top = (minutesFromStartOfGrid(b.startTime) / SLOT_MIN) * SLOT_PX;
                    const durationMin =
                      (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000;
                    const height = Math.max(18, (durationMin / SLOT_MIN) * SLOT_PX - 2);
                    if (top < 0 || top > TOTAL_PX) return null;
                    const reservante = b.user?.name ?? '';
                    const horaLabel = `${b.startTime.slice(11, 16)}–${b.endTime.slice(11, 16)}`;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        // El bloque va encima de las celdas: stopPropagation evita
                        // que el click abra además el diálogo de nueva reserva.
                        onClick={(e) => {
                          e.stopPropagation();
                          setOccupiedMsg(null);
                          setSelectedBooking(b);
                        }}
                        title={`${b.title}${reservante ? ` · ${reservante}` : ''} · ${horaLabel}`}
                        style={{ top, height }}
                        className={cn(
                          'absolute inset-x-0.5 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[10px] leading-tight transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-black/40',
                          STATUS_STYLES[b.status] ?? 'bg-slate-100 border-slate-300 text-slate-700',
                        )}
                      >
                        <p className="truncate font-semibold">{b.title}</p>
                        <p className="truncate opacity-80">{horaLabel}</p>
                        {reservante && <p className="truncate opacity-70">{reservante}</p>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {newBooking && (
        <BookRoomDialog
          room={newBooking.room}
          officeName={officeName}
          date={date}
          startTime={newBooking.startTime}
          durationHours={1}
          onClose={() => setNewBooking(null)}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          roomName={roomNameOf(selectedBooking)}
          officeName={officeName}
          isOwner={Boolean(user) && selectedBooking.userId === user?.id}
          canManage={canManage}
          onClose={() => setSelectedBooking(null)}
          onEdit={() => {
            setEditBooking(selectedBooking);
            setSelectedBooking(null);
          }}
          onCancel={() => {
            setCancelTarget(selectedBooking);
            setSelectedBooking(null);
          }}
        />
      )}

      {/* La sala sale de `rooms`, no de booking.room: el endpoint de calendario
          no trae la relación office, que BookRoomDialog necesita para el header. */}
      {editBooking && roomOf(editBooking) && (
        <BookRoomDialog
          room={roomOf(editBooking)!}
          officeName={officeName}
          date={editBooking.startTime.slice(0, 10)}
          startTime={editBooking.startTime.slice(11, 16)}
          durationHours={
            (new Date(editBooking.endTime).getTime() - new Date(editBooking.startTime).getTime()) /
            3600000
          }
          booking={editBooking}
          onClose={() => setEditBooking(null)}
        />
      )}

      {cancelTarget && (
        <CancelBookingDialog booking={cancelTarget} onClose={() => setCancelTarget(null)} />
      )}
    </div>
  );
}
