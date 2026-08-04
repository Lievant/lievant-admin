'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Room } from '@/lib/api';
import { PeopleIcon } from '@/components/icons';
import { BookRoomDialog } from '../book-room-dialog';
import { AMENITY_ICONS, ROOM_TYPE_BADGE_STYLES, ROOM_TYPE_LABELS, todayDateString } from '../constants';
import { RoomCalendar } from './room-calendar';

interface RoomDetailScreenProps {
  room: Room;
}

export function RoomDetailScreen({ room }: RoomDetailScreenProps) {
  const [booking, setBooking] = useState<{ date: string; startTime: string } | null>(null);

  return (
    <div>
      <Link href="/herramientas/salas" className="text-sm font-medium text-black hover:text-black">
        ← Volver a salas
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-navy">{room.name}</h1>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROOM_TYPE_BADGE_STYLES[room.type])}>
              {ROOM_TYPE_LABELS[room.type]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Herramientas · Reserva de salas</p>
        </div>
        <button
          type="button"
          onClick={() => setBooking({ date: todayDateString(), startTime: '09:00' })}
          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Reservar esta sala
        </button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Capacidad</p>
          <p className="mt-1 flex items-center gap-1.5 font-medium text-navy">
            <PeopleIcon className="h-4 w-4" />
            {room.capacity} personas
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Oficina</p>
          <p className="mt-1 font-medium text-navy">{room.office?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Piso</p>
          <p className="mt-1 font-medium text-navy">{room.floor ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Horario de operación</p>
          <p className="mt-1 font-medium text-navy">
            {room.openTime.slice(0, 5)} - {room.closeTime.slice(0, 5)}
          </p>
        </div>
      </div>

      {room.amenities.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amenidades</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {room.amenities.map((amenity) => {
              const Icon = AMENITY_ICONS[amenity];
              return (
                <span key={amenity} className="flex items-center gap-1.5 text-sm text-slate-600">
                  {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                  {amenity}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <RoomCalendar room={room} onSlotClick={(date, startTime) => setBooking({ date, startTime })} />
      </div>

      {booking && (
        <BookRoomDialog
          room={room}
          officeName={room.office?.name ?? ''}
          date={booking.date}
          startTime={booking.startTime}
          durationHours={1}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  );
}
