import { getCurrentUser } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { RiacScreen } from './riac-screen';

export const dynamic = 'force-dynamic';

/** RIAC: solo con rrhh.capacitaciones.read (el API lo exige también en cada consulta). */
export default async function RiacPage() {
  const user = await getCurrentUser().catch(() => null);
  const allowed = user?.permissions.some(
    (p) => p.section === 'rrhh' && p.module === 'capacitaciones' && p.action === 'read',
  );
  if (!allowed) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">
        <NoPermissions />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
      <RiacScreen />
    </div>
  );
}
