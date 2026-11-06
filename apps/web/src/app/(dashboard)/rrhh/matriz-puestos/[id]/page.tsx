import { getCurrentUser } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { PositionDetailScreen } from './position-detail-screen';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PositionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser().catch(() => null);
  const allowed = user?.permissions.some(
    (p) => p.section === 'rrhh' && p.module === 'matriz-puestos' && p.action === 'read',
  );
  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
      {allowed ? <PositionDetailScreen id={id} /> : <NoPermissions />}
    </div>
  );
}
