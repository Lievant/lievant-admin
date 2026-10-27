import { getCurrentUser, listEquipmentAuditTechnicians } from '@/lib/api';
import { NewAuditForm } from './new-audit-form';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export default async function NewAuditPage() {
  const [technicians, me] = await Promise.all([safe(listEquipmentAuditTechnicians()), safe(getCurrentUser())]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <NewAuditForm technicians={technicians ?? []} currentUserId={me?.id ?? null} />
    </div>
  );
}
