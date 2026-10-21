import { notFound } from 'next/navigation';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ApiError, getEquipmentAudit, listEquipmentAuditTechnicians, type EquipmentAuditDetail } from '@/lib/api';
import { AuditDetailScreen } from './audit-detail-screen';

interface AuditDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditDetailPage({ params }: AuditDetailPageProps) {
  const { id } = await params;

  let audit: EquipmentAuditDetail | null = null;
  let fetchError: string | null = null;
  try {
    audit = await getEquipmentAudit(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    if (err instanceof ApiError && err.status === 403) return <NoPermissions />;
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!audit) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{fetchError}</div>
      </div>
    );
  }

  const technicians = await listEquipmentAuditTechnicians().catch(() => []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <AuditDetailScreen initialAudit={audit} technicians={technicians} />
    </div>
  );
}
