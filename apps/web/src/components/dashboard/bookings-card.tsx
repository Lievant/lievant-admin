'use client';

import type { DashboardBooking } from '@/lib/api';
import Link from 'next/link';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface Props {
  bookings: DashboardBooking[];
}

export function BookingsCard({ bookings }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-navy text-sm">Mis reservas de hoy</h2>
        <Link
          href="/herramientas/salas"
          className="text-xs text-black hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No tienes reservas para hoy.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex items-start gap-2 rounded-lg bg-zinc-50 px-3 py-2"
            >
              <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-black mt-2" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy truncate">{b.title}</p>
                <p className="text-xs text-slate-500">
                  {b.roomName} · {formatTime(b.startTime)} – {formatTime(b.endTime)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
