import {
  getRoomAdminScope,
  listRoomCitiesByCountry,
  listRoomCountries,
  listRoomOfficesByCity,
  searchRooms,
  type RoomAvailability,
  type RoomType,
  type SearchRoomsParams,
} from '@/lib/api';
import { todayDateString } from './constants';
import { RoomsScreen } from './rooms-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
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

  const [countries, adminScope] = await Promise.all([safe(listRoomCountries()), safe(getRoomAdminScope())]);

  const cities = countryId ? await safe(listRoomCitiesByCountry(countryId)) : null;
  const offices = cityId ? await safe(listRoomOfficesByCity(cityId)) : null;

  let rooms: RoomAvailability[] | null = null;
  if (officeId) {
    const query: SearchRoomsParams = {
      office_id: officeId,
      date,
      start_time: startTime,
      duration_hours: durationHours,
    };
    if (roomType) query.room_type = roomType;
    rooms = await safe(searchRooms(query));
  }

  const isAdmin = Boolean(adminScope?.isGlobalAdmin || (adminScope?.officeIds.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <RoomsScreen
        countries={countries ?? []}
        cities={cities ?? []}
        offices={offices ?? []}
        rooms={rooms}
        apiUnavailable={countries === null}
        isAdmin={isAdmin}
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
