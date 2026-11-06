import { getCurrentUser } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ImportScreen } from './import-screen';

export const dynamic = 'force-dynamic';

/** Importación de la Matriz de Puestos desde Excel: solo con rrhh.matriz-puestos.import (el API lo exige de nuevo). */
export default async function ImportarMatrizPage() {
  const user = await getCurrentUser().catch(() => null);
  const allowed = user?.permissions.some((p) => p.section === 'rrhh' && p.module === 'matriz-puestos' && p.action === 'import');
  return <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8">{allowed ? <ImportScreen /> : <NoPermissions />}</div>;
}
