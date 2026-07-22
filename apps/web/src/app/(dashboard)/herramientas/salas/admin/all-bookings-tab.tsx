'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Booking, ListAdminBookingsParams, Room } from '@/lib/api';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { cancelBookingAction, listAdminBookingsAction, listRoomsByOfficeAction } from '../actions';
import { BOOKING_STATUS_BADGE_STYLES, BOOKING_STATUS_LABELS, formatDateTimeRange } from '../constants';
import { SelectField, TextField } from '../form-field';
import type { OfficeOption } from './office-options';

interface AllBookingsTabProps {
  offices: OfficeOption[];
}

export function AllBookingsTab({ offices }: AllBookingsTabProps) {
  const router = useRouter();
  const [officeId, setOfficeId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!officeId) {
      setRooms([]);
      setRoomId('');
      return;
    }
    startTransition(async () => {
      const result = await listRoomsByOfficeAction(officeId);
      setRooms(result ?? []);
      setRoomId('');
    });
  }, [officeId]);

  useEffect(() => {
    startTransition(async () => {
      const params: ListAdminBookingsParams = {};
      if (officeId) params.office_id = officeId;
      if (roomId) params.room_id = roomId;
      if (date) {
        params.date_from = date;
        params.date_to = date;
      }
      const result = await listAdminBookingsAction(params);
      setBookings(result);
    });
  }, [officeId, roomId, date]);

  function handleCancel(id: string) {
    startTransition(async () => {
      const result = await cancelBookingAction(id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo cancelar la reserva.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <SelectField id="bookings-office" label="Oficina" value={officeId} onChange={setOfficeId}>
          <option value="">Todas</option>
          {offices.map((office) => (
            <option key={office.id} value={office.id}>
              {office.name} · {office.cityName}
            </option>
          ))}
        </SelectField>
        <SelectField id="bookings-room" label="Sala" value={roomId} onChange={setRoomId} disabled={!officeId}>
          <option value="">Todas</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </SelectField>
        <TextField id="bookings-date" label="Fecha" type="date" value={date} onChange={setDate} />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      {bookings === null ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          {isPending ? 'Cargando…' : 'No se pudieron cargar las reservas.'}
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          No se encontraron reservas.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Sala</th>
                <th className="px-4 py-3">Oficina</th>
                <th className="px-4 py-3">Fecha y hora</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-navy">{booking.room?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {booking.room?.office?.name ?? '—'}
                    {booking.room?.office?.city?.name ? ` · ${booking.room.office.city.name}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTimeRange(booking.startTime, booking.endTime)}</td>
                  <td className="px-4 py-3 text-slate-500">{booking.user?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BOOKING_STATUS_BADGE_STYLES[booking.status]}`}>
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {booking.status !== 'cancelada' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(booking.id)}
                        disabled={isPending}
                        className="text-sm font-medium text-terracota hover:underline disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollableTable>
        </div>
      )}
    </div>
  );
}
