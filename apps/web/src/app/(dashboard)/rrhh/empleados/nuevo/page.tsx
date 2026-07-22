import { getCurrentUser } from '@/lib/api';
import { loadEmployeeFormCatalogs } from '../catalog-data';
import { NewEmployeeForm } from './new-employee-form';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function NewEmployeePage() {
  const [currentUser, catalogs] = await Promise.all([safe(getCurrentUser()), loadEmployeeFormCatalogs()]);
  const isSuperAdmin = currentUser?.roles.some((role) => role.name === 'SUPER_ADMIN') ?? false;
  const canEditPersonal =
    isSuperAdmin ||
    (currentUser?.permissions.some((p) => p.section === 'rrhh' && p.module === 'empleados.personal' && p.action === 'write') ?? false);
  const canEditCompensation =
    isSuperAdmin ||
    (currentUser?.permissions.some((p) => p.section === 'rrhh' && p.module === 'empleados.nomina' && p.action === 'write') ?? false);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <NewEmployeeForm canEditPersonal={canEditPersonal} canEditCompensation={canEditCompensation} catalogs={catalogs} />
    </div>
  );
}
