import { listEmployees, type DocStatus, type EmployeeStatus, type ListEmployeesParams } from '@/lib/api';
import { loadEmployeeFilterCatalogs } from './catalog-data';
import { EmployeesScreen } from './employees-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

interface EmpleadosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EmpleadosPage({ searchParams }: EmpleadosPageProps) {
  const params = await searchParams;

  const cursor = asString(params.cursor);
  const status = asString(params.status) as EmployeeStatus | undefined;
  const companyCode = asString(params.companyCode);
  const division = asString(params.division);
  const location = asString(params.location);
  const search = asString(params.search);
  const docStatus = asString(params.docStatus) as DocStatus | undefined;
  const cursors = asString(params.cursors);

  const query: ListEmployeesParams = { limit: 10 };
  if (cursor) query.cursor = cursor;
  if (status) query.status = status;
  if (companyCode) query.companyCode = companyCode;
  if (division) query.division = division;
  if (location) query.location = location;
  if (search) query.search = search;
  if (docStatus) query.docStatus = docStatus;

  const [employeesPage, catalogs] = await Promise.all([safe(listEmployees(query)), loadEmployeeFilterCatalogs()]);
  const apiUnavailable = employeesPage === null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <EmployeesScreen
        page={
          employeesPage ?? {
            data: [],
            nextCursor: null,
            stats: { total: 0, active: 0, inactive: 0, companies: 0, expiringContracts: 0 },
          }
        }
        apiUnavailable={apiUnavailable}
        filters={{
          status: status ?? '',
          companyCode: companyCode ?? '',
          division: division ?? '',
          location: location ?? '',
          search: search ?? '',
          docStatus: docStatus ?? '',
        }}
        cursor={cursor ?? ''}
        cursorsStack={cursors ? cursors.split(',').filter(Boolean) : []}
        catalogs={catalogs}
      />
    </div>
  );
}
