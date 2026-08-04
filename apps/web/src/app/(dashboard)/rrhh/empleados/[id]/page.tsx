import { notFound } from 'next/navigation';
import {
  ApiError,
  getCurrentUser,
  getEmployee,
  getEmployeeCompensation,
  getEmployeePersonalData,
  getEmployeeTermination,
  getEmployeeVacationSummary,
  listEmployeeContacts,
  listEmployeeDocuments,
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
        <div className="rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          {fetchError}
        </div>
      </div>
    );
  }

  const currentUser = await safe(getCurrentUser());
  const perms = currentUser?.permissions ?? [];

  const hasPermission = (section: string, module: string, action?: string) =>
    perms.some(
      (p) =>
        p.section === section &&
        p.module === module &&
        (action === undefined || p.action === action),
    );

  const canViewPersonal     = hasPermission('rrhh', 'empleados.personal');
  const canViewCompensation = hasPermission('rrhh', 'empleados.nomina');
  const canGenerateDocs     = hasPermission('rrhh', 'empleados.documentos', 'write');
  const canViewDocuments    = hasPermission('rrhh', 'empleados.documentos');
  const canViewVacations    = hasPermission('rrhh', 'empleados.vacaciones');

  const [personal, compensation, vacationSummary, contacts, termination, catalogs, documents] = await Promise.all([
    canViewPersonal ? safe(getEmployeePersonalData(id)) : Promise.resolve(null),
    canViewCompensation ? safe(getEmployeeCompensation(id)) : Promise.resolve(null),
    canViewVacations ? safe(getEmployeeVacationSummary(id)) : Promise.resolve(null),
    canViewPersonal ? safe(listEmployeeContacts(id)) : Promise.resolve(null),
    (canViewPersonal || canGenerateDocs) ? safe(getEmployeeTermination(id)) : Promise.resolve(null),
    loadEmployeeFormCatalogs(),
    canViewDocuments ? safe(listEmployeeDocuments(id)) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <EmployeeDetailScreen
        employee={employee}
        personal={personal}
        compensation={compensation}
        vacationSummary={vacationSummary}
        contacts={contacts ?? []}
        termination={termination}
        catalogs={catalogs}
        documents={documents ?? []}
      />
    </div>
  );
}
