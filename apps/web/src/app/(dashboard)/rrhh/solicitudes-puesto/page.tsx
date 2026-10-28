import { getCurrentUser } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ReviewScreen } from './review-screen';

export const dynamic = 'force-dynamic';

/** Solicitudes de Puesto (RRHH): solo con rrhh.solicitudes-puesto.read (el API lo exige en cada consulta). */
export default async function SolicitudesPuestoPage() {
  const user = await getCurrentUser().catch(() => null);
  const allowed = user?.permissions.some(
    (p) => p.section === 'rrhh' && p.module === 'solicitudes-puesto' && p.action === 'read',
  );
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
      {allowed ? <ReviewScreen /> : <NoPermissions />}
    </div>
  );
}
