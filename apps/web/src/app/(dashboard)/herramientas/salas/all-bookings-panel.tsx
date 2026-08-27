'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import type { Booking } from '@/lib/api';
import { listAdminBookingsAction } from './actions';
import { BookRoomDialog } from './book-room-dialog';
import { CancelBookingDialog } from './mis-reservas/cancel-booking-dialog';
import {
  BOOKING_STATUS_BADGE_STYLES,
  BOOKING_STATUS_LABELS,
  formatDateTimeRange,
  formatDurationLabel,
} from './constants';

/** Reservas por página al pulsar "Cargar más". Coincide con el default del API. */
const PAGE_SIZE = 50;

interface AllBookingsPanelProps {
  /** Primera página, renderizada en el servidor. */
  bookings: Booking[];
  /** Cursor de la página siguiente. null = no hay más. */
  initialCursor?: string | null;
  currentUserId: string | null;
}

/** Coincidencia laxa: ignora acentos y mayúsculas al buscar por colaborador. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function AllBookingsPanel({ bookings, initialCursor = null, currentUserId }: AllBookingsPanelProps) {
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);

  // Páginas traídas con "Cargar más", encima de la que vino del servidor.
  const [extraPages, setExtraPages] = useState<Booking[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  // Un router.refresh() (p. ej. tras cancelar) reemplaza la primera página: hay
  // que descartar lo acumulado o quedarían reservas duplicadas y desactualizadas.
  useEffect(() => {
    setExtraPages([]);
    setCursor(initialCursor);
    setLoadError(null);
  }, [bookings, initialCursor]);

  const loaded = useMemo(() => [...bookings, ...extraPages], [bookings, extraPages]);

  function handleLoadMore() {
    if (!cursor) return;
    setLoadError(null);
    startLoading(async () => {
      const page = await listAdminBookingsAction({ cursor, limit: PAGE_SIZE });
      if (!page) {
        setLoadError('No se pudieron cargar más reservas.');
        return;
      }
      setExtraPages((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    });
  }

  // Las salas se derivan de las propias reservas: evita una petición extra y
  // solo ofrece salas que realmente tienen reservas que filtrar.
  const roomOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const booking of loaded) {
      if (booking.room) {
        const officeName = booking.room.office?.name;
        byId.set(booking.room.id, officeName ? `${booking.room.name} · ${officeName}` : booking.room.name);
      }
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [loaded]);

  const filtered = useMemo(() => {
    const needle = normalize(search.trim());
    return loaded
      .filter((booking) => {
        if (roomId && booking.roomId !== roomId) return false;
        if (date && booking.startTime.slice(0, 10) !== date) return false;
        if (needle) {
          const haystack = normalize(
            `${booking.user?.name ?? ''} ${booking.user?.email ?? ''} ${booking.title}`,
          );
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [loaded, roomId, date, search]);

  const now = Date.now();
  const hasFilters = Boolean(roomId || date || search.trim());

  return (
    <div>
      <div className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="all-filter-room">
            Sala
          </label>
          <select
            id="all-filter-room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          >
            <option value="">Todas</option>
            {roomOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="all-filter-date">
            Fecha
          </label>
          <input
            id="all-filter-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="all-filter-search">
            Colaborador
          </label>
          <input
            id="all-filter-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, correo o motivo de la reserva…"
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'reserva' : 'reservas'}
        {hasFilters && ` de ${loaded.length} cargadas`}
        {/* Los filtros son en cliente: solo alcanzan a lo ya cargado. Decirlo
            evita leer "0 reservas" como "no existe" cuando sí hay más páginas. */}
        {cursor && hasFilters && ' · quedan reservas sin cargar'}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          {loaded.length === 0
            ? 'No hay reservas registradas.'
            : 'Ninguna reserva coincide con los filtros.'}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {filtered.map((booking) => {
            const room = booking.room;
            const office = room?.office;
            const isFuture = new Date(booking.endTime).getTime() > now;
            const isOwn = booking.userId === currentUserId;
            const canCancel =
              isFuture && (booking.status === 'confirmada' || booking.status === 'pendiente_aprobacion');
            const canEdit = canCancel && Boolean(room);

            return (
              <div
                key={booking.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-navy">{booking.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {booking.user?.name ?? booking.user?.email ?? 'Usuario desconocido'}
                    {isOwn && <span className="ml-1 text-xs text-slate-400">(tú)</span>}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {room?.name ?? 'Sala'}
                    {office?.name ? ` · ${office.name}` : ''}
                    {office?.city?.name ? ` · ${office.city.name}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDateTimeRange(booking.startTime, booking.endTime)} ·{' '}
                    {formatDurationLabel(booking.startTime, booking.endTime)}
                  </p>
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
                    {/* Solo si la reserva sigue vigente: el link de una reunión
                        que ya pasó no sirve de nada y ensucia la lista. */}
                    {booking.teamsMeetingUrl && isFuture && (
                      <a
                        href={booking.teamsMeetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-[#4B53BC] px-3 py-1 text-xs font-semibold text-white hover:bg-[#3d44a0]"
                      >
                        Unirse a Teams
                      </a>
                    )}
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

      {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}

      {cursor && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 disabled:opacity-60"
          >
            {isLoading ? 'Cargando…' : 'Cargar más'}
          </button>
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
