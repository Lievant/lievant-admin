import {
  listActiveRoomsByOffice,
  listCalendarBookings,
  listRoomCitiesByCountry,
  listRoomCountries,
  listRoomOfficesByCity,
  type Booking,
  type Office,
  type Room,
} from '@/lib/api';
import { todayDateString } from '../constants';
import { RoomCalendarView } from './room-calendar-view';

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/** Resuelve la oficina de León (México) como default. */
async function resolveDefaultOffice(): Promise<{ officeId: string | null; offices: Office[] }> {
  const countries = await safe(listRoomCountries(), []);
  const mx = countries.find((c) => c.code === 'MX' || /m[eé]xico/i.test(c.name));
  if (!mx) return { officeId: null, offices: [] };
  const cities = await safe(listRoomCitiesByCountry(mx.id), []);
  const leon = cities.find((c) => /le[oó]n/i.test(c.name));
  if (!leon) return { officeId: null, offices: [] };
  const offices = await safe(listRoomOfficesByCity(leon.id), []);
  const leonOffice = offices.find((o) => /le[oó]n/i.test(o.name)) ?? offices[0] ?? null;
  return { officeId: leonOffice?.id ?? null, offices };
}

interface CalendarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CalendarioPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const date = asString(params.date) ?? todayDateString();

  const { officeId: defaultOfficeId, offices } = await resolveDefaultOffice();
  const officeId = asString(params.office_id) ?? defaultOfficeId ?? '';

  let rooms: Room[] = [];
  let bookings: Booking[] = [];
  if (officeId) {
    // Endpoint de lectura, no el de admin: la vista de calendario es accesible a
    // cualquier usuario autenticado. Con /rooms/admin el 403 lo absorbía safe()
    // y el calendario quedaba sin columnas para quien no fuera admin de oficina.
    rooms = await safe(listActiveRoomsByOffice(officeId), []);
    bookings = await safe(listCalendarBookings(officeId, date), []);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <RoomCalendarView
        rooms={rooms}
        bookings={bookings}
        offices={offices}
        officeId={officeId}
        date={date}
      />
    </div>
  );
}
