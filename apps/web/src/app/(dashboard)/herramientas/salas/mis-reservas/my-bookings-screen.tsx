'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Booking, ErrorKind } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import {
  BOOKING_STATUS_BADGE_STYLES,
  BOOKING_STATUS_LABELS,
  formatDateTimeRange,
  formatDurationLabel,
} from '../constants';
import { CancelBookingDialog } from './cancel-booking-dialog';
import { BookRoomDialog } from '../book-room-dialog';

type Tab = 'proximas' | 'pasadas' | 'canceladas';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'proximas', label: 'Próximas' },
  { id: 'pasadas', label: 'Pasadas' },
  { id: 'canceladas', label: 'Canceladas' },
];

const EMPTY_MESSAGES: Record<Tab, string> = {
  proximas: 'No tienes reservas próximas.',
  pasadas: 'No tienes reservas pasadas.',
  canceladas: 'No tienes reservas canceladas.',
};

/** Pasadas y canceladas muestran solo las más recientes. */
const HISTORY_LIMIT = 20;

interface MyBookingsScreenProps {
  bookings: Booking[];
  errorKind: ErrorKind | null;
}

export function MyBookingsScreen({ bookings, errorKind }: MyBookingsScreenProps) {
  const [tab, setTab] = useState<Tab>('proximas');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);

  const source = bookings;

  // startTime/endTime son timestamptz, así que Date.now() es la referencia
  // correcta: comparar epochs no depende de la zona horaria. (Antes se derivaba
  // "ahora" con toLocaleString('America/Mexico_City') y se reparseaba como hora
  // local, lo que desplazaba la referencia varias horas y hacía que reservas ya
  // terminadas siguieran apareciendo como próximas.)
  const now = Date.now();
  const isFuture = (booking: Booking) => new Date(booking.endTime).getTime() > now;
  const byStartAsc = (a: Booking, b: Booking) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  const byStartDesc = (a: Booking, b: Booking) => -byStartAsc(a, b);

  const upcomingBookings = source
    .filter((b) => b.status !== 'cancelada' && isFuture(b))
    .sort(byStartAsc);

  // Pasadas y canceladas: más reciente primero y solo las últimas 20.
  const pastBookings = source
    .filter((b) => b.status !== 'cancelada' && !isFuture(b))
    .sort(byStartDesc)
    .slice(0, HISTORY_LIMIT);

  const cancelledBookings = source
    .filter((b) => b.status === 'cancelada')
    .sort(byStartDesc)
    .slice(0, HISTORY_LIMIT);

  const totalPast = source.filter((b) => b.status !== 'cancelada' && !isFuture(b)).length;
  const totalCancelled = source.filter((b) => b.status === 'cancelada').length;

  const filtered =
    tab === 'proximas' ? upcomingBookings : tab === 'pasadas' ? pastBookings : cancelledBookings;
  const hiddenCount =
    tab === 'pasadas'
      ? totalPast - pastBookings.length
      : tab === 'canceladas'
        ? totalCancelled - cancelledBookings.length
        : 0;

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Mis reservas</h1>
          <p className="mt-1 text-sm text-slate-500">Herramientas · Reserva de salas</p>
        </div>
        <Link
          href="/herramientas/salas"
          className="shrink-0 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          ← Reserva de salas
        </Link>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión para ver datos en vivo.
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'border-terracota text-terracota' : 'border-transparent text-slate-500 hover:text-navy',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          {EMPTY_MESSAGES[tab]}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {hiddenCount > 0 && (
            <p className="text-xs text-slate-400">
              Mostrando las {HISTORY_LIMIT} más recientes de {filtered.length + hiddenCount}.
            </p>
          )}
          {filtered.map((booking) => {
            const room = booking.room;
            const office = room?.office;
            const city = office?.city;
            const bookingIsFuture = isFuture(booking);
            const canCancel =
              bookingIsFuture &&
              (booking.status === 'confirmada' || booking.status === 'pendiente_aprobacion');
            const canEdit = canCancel && Boolean(room);

            return (
              <div
                key={booking.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{booking.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {room?.name ?? 'Sala'}
                    {office?.name ? ` · ${office.name}` : ''}
                    {city?.name ? ` · ${city.name}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{formatDateTimeRange(booking.startTime, booking.endTime)}</p>
                  <p className="mt-1 text-sm text-slate-500">Duración: {formatDurationLabel(booking.startTime, booking.endTime)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      BOOKING_STATUS_BADGE_STYLES[booking.status],
                    )}
                  >
                    {BOOKING_STATUS_LABELS[booking.status]}
                  </span>
                  <div className="flex gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditTarget(booking)}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                      >
                        Modificar
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(booking)}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:border-red-300"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && <CancelBookingDialog booking={cancelTarget} onClose={() => setCancelTarget(null)} />}

      {editTarget && editTarget.room && (
        <BookRoomDialog
          room={editTarget.room}
          officeName={editTarget.room.office?.name ?? ''}
          date={editTarget.startTime.slice(0, 10)}
          startTime={editTarget.startTime.slice(11, 16)}
          durationHours={
            (new Date(editTarget.endTime).getTime() - new Date(editTarget.startTime).getTime()) / 3600000
          }
          booking={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
