import {
  errorKindOf,
  getCurrentUser,
  getRoomAdminScope,
  listAdminBookings,
  listRoomCitiesByCountry,
  listRoomCountries,
  listRoomOfficesByCity,
  searchRooms,
  type Booking,
  type CurrentUser,
  type ErrorKind,
  type RoomAvailability,
  type RoomType,
  type SearchRoomsParams,
} from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { todayDateString } from './constants';
import { RoomsScreen } from './rooms-screen';

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

interface SalasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SalasPage({ searchParams }: SalasPageProps) {
  const params = await searchParams;

  const countryId = asString(params.country_id);
  const cityId = asString(params.city_id);
  const officeId = asString(params.office_id);
  const date = asString(params.date) ?? todayDateString();
  const startTime = asString(params.start_time) ?? '09:00';
  const durationHours = Number(asString(params.duration_hours) ?? '1');
  const roomType = asString(params.room_type) as RoomType | undefined;

  const [countriesResult, adminScopeResult] = await Promise.all([safe(listRoomCountries()), safe(getRoomAdminScope())]);

  const cities = countryId ? (await safe(listRoomCitiesByCountry(countryId))).data : null;
  const offices = cityId ? (await safe(listRoomOfficesByCity(cityId))).data : null;

  let rooms: RoomAvailability[] | null = null;
  if (officeId) {
    const query: SearchRoomsParams = {
      office_id: officeId,
      date,
      start_time: startTime,
      duration_hours: durationHours,
    };
    if (roomType) query.room_type = roomType;
    rooms = (await safe(searchRooms(query))).data;
  }

  const adminScope = adminScopeResult.data;
  const isAdmin = Boolean(adminScope?.isGlobalAdmin || (adminScope?.officeIds.length ?? 0) > 0);

  let user: CurrentUser | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  // La pestaña "Todas las reservas" y su carga solo existen con salas.manage.
  const canManageAll = hasPermission(user, 'herramientas', 'salas', 'manage');
  let allBookings: Booking[] = [];
  if (canManageAll) {
    allBookings = (await safe(listAdminBookings())).data ?? [];
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <RoomsScreen
        countries={countriesResult.data ?? []}
        cities={cities ?? []}
        offices={offices ?? []}
        rooms={rooms}
        errorKind={countriesResult.errorKind}
        isAdmin={isAdmin}
        canManageAll={canManageAll}
        allBookings={allBookings}
        currentUserId={user?.id ?? null}
        filters={{
          country_id: countryId ?? '',
          city_id: cityId ?? '',
          office_id: officeId ?? '',
          date,
          start_time: startTime,
          duration_hours: String(durationHours),
          room_type: roomType ?? '',
        }}
      />
    </div>
  );
}
