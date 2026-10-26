import { getCurrentUser } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { PositionsScreen } from './positions-screen';

export const dynamic = 'force-dynamic';

/** Matriz de Puestos: solo con rrhh.matriz-puestos.read (el API lo exige en cada consulta). */
export default async function MatrizPuestosPage() {
  const user = await getCurrentUser().catch(() => null);
  const allowed = user?.permissions.some(
    (p) => p.section === 'rrhh' && p.module === 'matriz-puestos' && p.action === 'read',
  );
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
      {allowed ? <PositionsScreen /> : <NoPermissions />}
    </div>
  );
}
