'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Booking } from '@/lib/api';
import { approveBookingAction, rejectBookingAction } from '../actions';
import { formatDateTimeRange } from '../constants';

interface PendingApprovalsTabProps {
  bookings: Booking[];
}

export function PendingApprovalsTab({ bookings }: PendingApprovalsTabProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);

  function handleApprove(id: string) {
    setActingId(id);
    startTransition(async () => {
      const result = await approveBookingAction(id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo aprobar la reserva.');
      }
    });
  }

  function handleReject(id: string) {
    setActingId(id);
    startTransition(async () => {
      const result = await rejectBookingAction(id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo rechazar la reserva.');
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
        No hay reservas pendientes de aprobación.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div>
            <p className="font-semibold text-navy">{booking.title}</p>
            <p className="mt-1 text-sm text-slate-500">
              {booking.room?.name}
              {booking.room?.office?.name ? ` · ${booking.room.office.name}` : ''}
              {booking.room?.office?.city?.name ? ` · ${booking.room.office.city.name}` : ''}
            </p>
            <p className="mt-1 text-sm text-slate-500">{formatDateTimeRange(booking.startTime, booking.endTime)}</p>
            <p className="mt-1 text-sm text-slate-500">Solicitado por: {booking.user?.name ?? '—'}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleApprove(booking.id)}
              disabled={isPending && actingId === booking.id}
              className="rounded-md bg-terracota px-3 py-1.5 text-sm font-semibold text-white hover:bg-terracota-dark disabled:opacity-60"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => handleReject(booking.id)}
              disabled={isPending && actingId === booking.id}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
