import { notFound } from 'next/navigation';
import {
  ApiError,
  getCurrentUser,
  getEmployee,
  getEmployeeCompensation,
  getEmployeePersonalData,
  getEmployeeTermination,
  listEmployeeContacts,
  listEmployeeVacations,
  type EmployeeDetail,
} from '@/lib/api';
import { loadEmployeeFormCatalogs } from '../catalog-data';
import { EmployeeDetailScreen } from './employee-detail-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { id } = await params;

  let employee: EmployeeDetail | null = null;
  let fetchError: string | null = null;

  try {
    employee = await getEmployee(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!employee) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          {fetchError}
        </div>
      </div>
    );
  }

  const currentUser = await safe(getCurrentUser());
  const roleNames = currentUser?.roles.map((role) => role.name) ?? [];
  const canViewPersonal = roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN_RRHH');
  const canViewCompensation = roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN_NOMINA');

  const [personal, compensation, vacations, contacts, termination, catalogs] = await Promise.all([
    canViewPersonal ? safe(getEmployeePersonalData(id)) : Promise.resolve(null),
    canViewCompensation ? safe(getEmployeeCompensation(id)) : Promise.resolve(null),
    canViewPersonal ? safe(listEmployeeVacations(id)) : Promise.resolve(null),
    canViewPersonal ? safe(listEmployeeContacts(id)) : Promise.resolve(null),
    canViewPersonal ? safe(getEmployeeTermination(id)) : Promise.resolve(null),
    loadEmployeeFormCatalogs(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <EmployeeDetailScreen
        employee={employee}
        personal={personal}
        compensation={compensation}
        vacations={vacations ?? []}
        contacts={contacts ?? []}
        termination={termination}
        canViewPersonal={canViewPersonal}
        canViewCompensation={canViewCompensation}
        catalogs={catalogs}
      />
    </div>
  );
}
