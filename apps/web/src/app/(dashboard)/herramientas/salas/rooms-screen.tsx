'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Booking, City, Country, ErrorKind, Office, RoomAvailability } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { PeopleIcon } from '@/components/icons';
import { AllBookingsPanel } from './all-bookings-panel';
import { BookRoomDialog } from './book-room-dialog';
import {
  AMENITY_ICONS,
  DURATION_OPTIONS,
  ROOM_TYPE_BADGE_STYLES,
  ROOM_TYPE_LABELS,
  ROOM_TYPE_OPTIONS,
  generateTimeSlots,
} from './constants';

interface RoomsFilters {
  country_id: string;
  city_id: string;
  office_id: string;
  date: string;
  start_time: string;
  duration_hours: string;
  room_type: string;
}

interface RoomsScreenProps {
  countries: Country[];
  cities: City[];
  offices: Office[];
  rooms: RoomAvailability[] | null;
  errorKind: ErrorKind | null;
  isAdmin: boolean;
  filters: RoomsFilters;
  /** herramientas.salas.manage: habilita la pestaña "Todas las reservas". */
  canManageAll?: boolean;
  allBookings?: Booking[];
  currentUserId?: string | null;
}

const TIME_SLOTS = generateTimeSlots();
const MAX_VISIBLE_AMENITIES = 4;

export function RoomsScreen({
  countries,
  cities,
  offices,
  rooms,
  errorKind,
  isAdmin,
  filters,
  canManageAll = false,
  allBookings = [],
  currentUserId = null,
}: RoomsScreenProps) {
  const router = useRouter();
  const [view, setView] = useState<'buscar' | 'todas'>('buscar');
  const [countryId, setCountryId] = useState(filters.country_id);
  const [cityId, setCityId] = useState(filters.city_id);
  const [officeId, setOfficeId] = useState(filters.office_id);
  const [date, setDate] = useState(filters.date);
  const [startTime, setStartTime] = useState(filters.start_time);
  const [durationHours, setDurationHours] = useState(filters.duration_hours);
  const [roomType, setRoomType] = useState(filters.room_type);
  const [bookingRoom, setBookingRoom] = useState<RoomAvailability | null>(null);

  // Mantener los selects sincronizados con la URL (filters). Necesario para que las
  // opciones pre-seleccionadas por el cascade de auto-selección se reflejen en los
  // dropdowns (el estado local se inicializa una sola vez y no sigue a las props solo).
  useEffect(() => {
    setCountryId(filters.country_id);
  }, [filters.country_id]);
  useEffect(() => {
    setCityId(filters.city_id);
  }, [filters.city_id]);
  useEffect(() => {
    setOfficeId(filters.office_id);
  }, [filters.office_id]);

  // Auto-selección México / León / León al entrar (solo si no hay filtros previos
  // y el usuario no ha interactuado). Se desactiva si algún catálogo no tiene el destino.
  const autoRef = useRef(true);

  // Paso 1: País → México (una sola vez, al montar).
  useEffect(() => {
    if (filters.country_id || filters.city_id || filters.office_id) {
      autoRef.current = false; // ya venía con filtros (p. ej. link compartido)
      return;
    }
    const mx = countries.find((c) => c.code === 'MX' || /m[eé]xico/i.test(c.name));
    if (mx) {
      navigate({ country_id: mx.id, city_id: '', office_id: '' });
    } else {
      autoRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paso 2: Ciudad → León (cuando cargan las ciudades de México).
  useEffect(() => {
    if (!autoRef.current || filters.city_id) return;
    const mxSelected = countries.some(
      (c) => c.id === filters.country_id && (c.code === 'MX' || /m[eé]xico/i.test(c.name)),
    );
    if (!mxSelected || cities.length === 0) return;
    const leon = cities.find((c) => /le[oó]n/i.test(c.name));
    if (leon) navigate({ city_id: leon.id, office_id: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  // Paso 3: Oficina → León (cuando cargan las oficinas de la ciudad de León).
  useEffect(() => {
    if (!autoRef.current || filters.office_id || !filters.city_id) return;
    if (offices.length === 0) return;
    const leonOffice = offices.find((o) => /le[oó]n/i.test(o.name));
    if (leonOffice) navigate({ office_id: leonOffice.id });
    autoRef.current = false; // fin del cascade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offices]);

  function navigate(overrides: Partial<RoomsFilters>) {
    // País/ciudad/oficina se toman de `filters` (la verdad de la URL) y no del
    // estado local, que queda desincronizado durante el cascade de auto-selección
    // (el estado no se actualiza en el mismo render en que llegan las props nuevas).
    // Fecha/hora/duración/tipo sí vienen del estado local: son campos de formulario
    // pendientes que aún no están en la URL hasta pulsar "Buscar".
    const next: RoomsFilters = {
      country_id: filters.country_id,
      city_id: filters.city_id,
      office_id: filters.office_id,
      date,
      start_time: startTime,
      duration_hours: durationHours,
      room_type: roomType,
      ...overrides,
    };
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value) sp.set(key, value);
    });
    router.push(`/herramientas/salas?${sp.toString()}`);
  }

  function handleCountryChange(value: string) {
    autoRef.current = false;
    setCountryId(value);
    setCityId('');
    setOfficeId('');
    navigate({ country_id: value, city_id: '', office_id: '' });
  }

  function handleCityChange(value: string) {
    autoRef.current = false;
    setCityId(value);
    setOfficeId('');
    navigate({ city_id: value, office_id: '' });
  }

  function handleOfficeChange(value: string) {
    autoRef.current = false;
    setOfficeId(value);
    navigate({ office_id: value });
  }

  function handleSearch() {
    navigate({});
  }

  const selectedOffice = offices.find((office) => office.id === officeId);

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reserva de salas</h1>
          <p className="mt-1 text-sm text-slate-500">Herramientas · Espacios de trabajo</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/herramientas/salas/calendario"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Vista calendario
          </Link>
          <Link
            href="/herramientas/salas/mis-reservas"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Mis reservas
          </Link>
          {isAdmin && (
            <Link
              href="/herramientas/salas/admin"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Admin
            </Link>
          )}
        </div>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          No se pudo conectar con la API. Inicia sesión para ver datos en vivo.
        </div>
      )}

      {canManageAll && (
        <div className="mt-6 flex gap-2 border-b border-slate-200">
          {([
            { id: 'buscar', label: 'Buscar salas' },
            { id: 'todas', label: 'Todas las reservas' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                view === t.id
                  ? 'border-black text-black'
                  : 'border-transparent text-slate-500 hover:text-navy',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {canManageAll && view === 'todas' && (
        <AllBookingsPanel bookings={allBookings} currentUserId={currentUserId} />
      )}

      {view === 'buscar' && (
        <>
      {/* Filters */}
      <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 lg:grid-cols-7">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-country">
            País
          </label>
          <select
            id="filter-country"
            value={countryId}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          >
            <option value="">Selecciona</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-city">
            Ciudad
          </label>
          <select
            id="filter-city"
            value={cityId}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={!countryId}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Selecciona</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-office">
            Oficina
          </label>
          <select
            id="filter-office"
            value={officeId}
            onChange={(e) => handleOfficeChange(e.target.value)}
            disabled={!cityId}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Selecciona</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-date">
            Fecha
          </label>
          <input
            id="filter-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-start-time">
            Hora inicio
          </label>
          <select
            id="filter-start-time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-duration">
            Duración
          </label>
          <select
            id="filter-duration"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="filter-room-type">
            Tipo
          </label>
          <select
            id="filter-room-type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          >
            {ROOM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 flex items-end md:col-span-1 lg:col-span-7">
          <button
            type="button"
            onClick={handleSearch}
            disabled={!officeId}
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Buscar disponibilidad
          </button>
        </div>
      </div>

      {/* Results */}
      {!officeId ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          Selecciona una oficina y horario para ver disponibilidad.
        </div>
      ) : rooms === null ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          No se pudo cargar la disponibilidad de salas.
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          No se encontraron salas para esta oficina.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const visibleAmenities = room.amenities.slice(0, MAX_VISIBLE_AMENITIES);
            const extraAmenities = room.amenities.length - visibleAmenities.length;

            return (
              <div
                key={room.id}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm',
                  room.is_available ? 'border-green-300' : 'border-red-200 bg-red-50/30',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{room.name}</p>
                    <span
                      className={cn(
                        'mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                        ROOM_TYPE_BADGE_STYLES[room.type],
                      )}
                    >
                      {ROOM_TYPE_LABELS[room.type]}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      room.is_available ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
                    )}
                  >
                    {room.is_available ? 'Disponible' : 'Ocupada'}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                  <PeopleIcon className="h-4 w-4" />
                  {room.capacity} personas
                </div>

                {room.amenities.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-slate-400">
                    {visibleAmenities.map((amenity) => {
                      const Icon = AMENITY_ICONS[amenity];
                      return Icon ? <Icon key={amenity} className="h-4 w-4" /> : null;
                    })}
                    {extraAmenities > 0 && <span className="text-xs text-slate-400">+{extraAmenities} más</span>}
                  </div>
                )}

                {room.is_available ? (
                  <button
                    type="button"
                    onClick={() => setBookingRoom(room)}
                    className="mt-4 w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    Reservar
                  </button>
                ) : (
                  <div className="mt-4 space-y-1">
                    {room.occupied_by && (
                      <p className="text-sm text-slate-600">
                        Reservada por: <span className="font-medium text-navy">{room.occupied_by.userName}</span>
                        <br />
                        {room.occupied_by.title}
                      </p>
                    )}
                    <Link
                      href={`/herramientas/salas/${room.id}`}
                      className="mt-2 block w-full rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-600 hover:border-slate-300"
                    >
                      Ver detalle
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {bookingRoom && (
        <BookRoomDialog
          room={bookingRoom}
          officeName={selectedOffice?.name ?? bookingRoom.office?.name ?? ''}
          date={date}
          startTime={startTime}
          durationHours={Number(durationHours)}
          onClose={() => setBookingRoom(null)}
        />
      )}
    </div>
  );
}
