import { listEquipmentBrands, listEquipmentStatuses, listEquipmentTypes } from '@/lib/api';
import { NewEquipmentForm } from './new-equipment-form';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export default async function NuevoEquipoPage() {
  const [types, brands, statuses] = await Promise.all([
    safe(listEquipmentTypes()),
    safe(listEquipmentBrands()),
    safe(listEquipmentStatuses()),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-navy">Nuevo equipo</h1>
      <NewEquipmentForm
        types={types ?? []}
        brands={brands ?? []}
        statuses={statuses ?? []}
      />
    </div>
  );
}
