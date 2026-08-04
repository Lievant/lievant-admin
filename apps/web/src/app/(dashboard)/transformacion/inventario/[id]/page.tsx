import { notFound } from 'next/navigation';
import { ApiError, getEquipment, listEquipmentBrands, listEquipmentStatuses, listEquipmentTypes, type EquipmentDetail } from '@/lib/api';
import { EquipmentDetailScreen } from './equipment-detail-screen';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

interface EquipmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EquipmentDetailPage({ params }: EquipmentDetailPageProps) {
  const { id } = await params;

  let equipment: EquipmentDetail | null = null;
  let fetchError: string | null = null;

  try {
    equipment = await getEquipment(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!equipment) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          {fetchError}
        </div>
      </div>
    );
  }

  const [types, brands, statuses] = await Promise.all([
    safe(listEquipmentTypes()),
    safe(listEquipmentBrands()),
    safe(listEquipmentStatuses()),
  ]);

  return (
    <div className="mx-auto max-w-screen-lg px-6 py-8">
      <EquipmentDetailScreen
        equipment={equipment}
        catalogs={{ types: types ?? [], brands: brands ?? [], statuses: statuses ?? [] }}
      />
    </div>
  );
}
