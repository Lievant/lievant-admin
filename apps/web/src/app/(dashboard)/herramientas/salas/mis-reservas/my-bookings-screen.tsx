'use client';

import { useState } from 'react';
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

interface MyBookingsScreenProps {
  bookings: Booking[];
  errorKind: ErrorKind | null;
}

export function MyBookingsScreen({ bookings, errorKind }: MyBookingsScreenProps) {
  const [tab, setTab] = useState<Tab>('proximas');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  const now = Date.now();

  const filtered = bookings.filter((booking) => {
    const isFuture = new Date(booking.startTime).getTime() >= now;
    if (tab === 'canceladas') return booking.status === 'cancelada';
    if (tab === 'proximas') return booking.status !== 'cancelada' && isFuture;
    return booking.status !== 'cancelada' && !isFuture;
  });

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header>
        <h1 className="text-2xl font-bold text-navy">Mis reservas</h1>
        <p className="mt-1 text-sm text-slate-500">Herramientas · Reserva de salas</p>
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
          {filtered.map((booking) => {
            const room = booking.room;
            const office = room?.office;
            const city = office?.city;
            const isFuture = new Date(booking.startTime).getTime() >= now;
            const canCancel =
              isFuture && (booking.status === 'confirmada' || booking.status === 'pendiente_aprobacion');

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
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(booking)}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && <CancelBookingDialog booking={cancelTarget} onClose={() => setCancelTarget(null)} />}
    </div>
  );
}
