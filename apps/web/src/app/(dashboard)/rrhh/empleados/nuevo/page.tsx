import { getCurrentUser } from '@/lib/api';
import { NewEmployeeForm } from './new-employee-form';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function NewEmployeePage() {
  const currentUser = await safe(getCurrentUser());
  const roleNames = currentUser?.roles.map((role) => role.name) ?? [];
  const canEditPersonal = roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN_RRHH');
  const canEditCompensation = roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN_NOMINA');

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <NewEmployeeForm canEditPersonal={canEditPersonal} canEditCompensation={canEditCompensation} />
    </div>
  );
}
