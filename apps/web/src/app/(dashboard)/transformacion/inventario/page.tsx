import {
  getEquipmentStats,
  listEquipment,
  listEquipmentBrands,
  listEquipmentStatuses,
  listEquipmentTypes,
  type EquipmentPage,
  type EquipmentStats,
  type ListEquipmentParams,
} from '@/lib/api';
import { InventoryScreen } from './inventory-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

interface InventarioPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InventarioPage({ searchParams }: InventarioPageProps) {
  const params = await searchParams;

  const cursor = asString(params.cursor);
  const cursors = asString(params.cursors);
  const search = asString(params.search);
  const equipmentType = asString(params.equipmentType);
  const brand = asString(params.brand);
  const status = asString(params.status);
  const location = asString(params.location);
  const area = asString(params.area);

  const query: ListEquipmentParams = { limit: 20 };
  if (cursor) query.cursor = cursor;
  if (search) query.search = search;
  if (equipmentType) query.equipmentType = equipmentType;
  if (brand) query.brand = brand;
  if (status) query.status = status;
  if (location) query.location = location;
  if (area) query.area = area;

  const [page, stats, types, brands, statuses] = await Promise.all([
    safe(listEquipment(query)),
    safe(getEquipmentStats()),
    safe(listEquipmentTypes()),
    safe(listEquipmentBrands()),
    safe(listEquipmentStatuses()),
  ]);

  const emptyPage: EquipmentPage = { data: [], nextCursor: null, total: 0 };
  const emptyStats: EquipmentStats = { total: 0, assigned: 0, available: 0, assignedPercent: 0, byType: [], byStatus: [] };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <InventoryScreen
        page={page ?? emptyPage}
        stats={stats ?? emptyStats}
        apiUnavailable={page === null}
        filters={{
          search: search ?? '',
          equipmentType: equipmentType ?? '',
          brand: brand ?? '',
          status: status ?? '',
          location: location ?? '',
          area: area ?? '',
        }}
        cursor={cursor ?? ''}
        cursorsStack={cursors ? cursors.split(',').filter(Boolean) : []}
        catalogs={{
          types: types ?? [],
          brands: brands ?? [],
          statuses: statuses ?? [],
        }}
      />
    </div>
  );
}
