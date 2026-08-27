import {
  errorKindOf,
  getCurrentUser,
  getRoomAdminScope,
  getRoomsCatalog,
  listAdminBookings,
  searchRooms,
  type Booking,
  type CurrentUser,
  type ErrorKind,
  type RoomAvailability,
  type RoomsCatalog,
  type RoomType,
  type SearchRoomsParams,
} from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { todayDateString } from './constants';
import { RoomsScreen } from './rooms-screen';

/** Tamaño de la primera página de "Todas las reservas". Coincide con el default del API. */
const ADMIN_BOOKINGS_PAGE_SIZE = 50;

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

interface LocationSelection {
  countryId: string;
  cityId: string;
  officeId: string;
}

/**
 * Resuelve país/ciudad/oficina contra el catálogo ya cargado.
 *
 * Antes esto vivía en el cliente como tres useEffect que hacían router.push en
 * cascada (México → León → oficina León), y cada push re-ejecutaba esta página
 * completa: cuatro renders de servidor para pintar una pantalla. Al tener el
 * árbol entero en memoria se resuelve aquí, en el primer y único render.
 */
function resolveLocation(catalog: RoomsCatalog | null, params: LocationSelection): LocationSelection {
  if (!catalog) return params;

  const countries = catalog.countries;
  const findByOffice = (officeId: string): LocationSelection | null => {
    for (const country of countries) {
      for (const city of country.cities) {
        if (city.offices.some((office) => office.id === officeId)) {
          return { countryId: country.id, cityId: city.id, officeId };
        }
      }
    }
    return null;
  };

  // Link compartido o navegación explícita: la URL manda, solo se completan los
  // niveles superiores que falten para que los selects queden coherentes.
  if (params.officeId) {
    return findByOffice(params.officeId) ?? params;
  }

  if (params.cityId) {
    const country = countries.find((c) => c.cities.some((city) => city.id === params.cityId));
    return { countryId: country?.id ?? params.countryId, cityId: params.cityId, officeId: '' };
  }

  if (params.countryId) {
    return { countryId: params.countryId, cityId: '', officeId: '' };
  }

  // Sin filtros: default México / León / oficina León, igual que antes.
  const mexico = countries.find((c) => c.code === 'MX' || /m[eé]xico/i.test(c.name));
  if (!mexico) return params;

  const leon = mexico.cities.find((city) => /le[oó]n/i.test(city.name));
  if (!leon) return { countryId: mexico.id, cityId: '', officeId: '' };

  const leonOffice = leon.offices.find((office) => /le[oó]n/i.test(office.name));
  return { countryId: mexico.id, cityId: leon.id, officeId: leonOffice?.id ?? '' };
}

interface SalasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SalasPage({ searchParams }: SalasPageProps) {
  const params = await searchParams;

  const date = asString(params.date) ?? todayDateString();
  const startTime = asString(params.start_time) ?? '09:00';
  const durationHours = Number(asString(params.duration_hours) ?? '1');
  const roomType = asString(params.room_type) as RoomType | undefined;

  const [catalogResult, adminScopeResult, userResult] = await Promise.all([
    safe(getRoomsCatalog()),
    safe(getRoomAdminScope()),
    safe(getCurrentUser()),
  ]);

  const catalog = catalogResult.data;
  const location = resolveLocation(catalog, {
    countryId: asString(params.country_id) ?? '',
    cityId: asString(params.city_id) ?? '',
    officeId: asString(params.office_id) ?? '',
  });

  let rooms: RoomAvailability[] | null = null;
  if (location.officeId) {
    const query: SearchRoomsParams = {
      office_id: location.officeId,
      date,
      start_time: startTime,
      duration_hours: durationHours,
    };
    if (roomType) query.room_type = roomType;
    rooms = (await safe(searchRooms(query))).data;
  }

  const adminScope = adminScopeResult.data;
  const isAdmin = Boolean(adminScope?.isGlobalAdmin || (adminScope?.officeIds.length ?? 0) > 0);
  const user: CurrentUser | null = userResult.data;

  // La pestaña "Todas las reservas" y su carga solo existen con salas.manage.
  const canManageAll = hasPermission(user, 'herramientas', 'salas', 'manage');
  let allBookings: Booking[] = [];
  let allBookingsCursor: string | null = null;
  if (canManageAll) {
    const page = (await safe(listAdminBookings({ limit: ADMIN_BOOKINGS_PAGE_SIZE }))).data;
    allBookings = page?.items ?? [];
    allBookingsCursor = page?.nextCursor ?? null;
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <RoomsScreen
        catalog={catalog ?? { countries: [] }}
        rooms={rooms}
        errorKind={catalogResult.errorKind}
        isAdmin={isAdmin}
        canManageAll={canManageAll}
        allBookings={allBookings}
        allBookingsCursor={allBookingsCursor}
        currentUserId={user?.id ?? null}
        filters={{
          country_id: location.countryId,
          city_id: location.cityId,
          office_id: location.officeId,
          date,
          start_time: startTime,
          duration_hours: String(durationHours),
          room_type: roomType ?? '',
        }}
      />
    </div>
  );
}
