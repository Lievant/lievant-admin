import {
  getLicenseStats,
  listActiveCatalogItems,
  listLicenses,
  listLicenseTools,
  type LicenseEmployeeRow,
  type LicenseStats,
  type ListLicensesParams,
  type ToolCatalogItem,
} from '@/lib/api';
import { LicensesScreen } from './licenses-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

interface LicenciamientosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LicenciamientosPage({ searchParams }: LicenciamientosPageProps) {
  const params = await searchParams;

  const search = asString(params.search);
  const tool = asString(params.tool);
  const hasAccessRaw = asString(params.hasAccess);
  const department = asString(params.department);
  const division = asString(params.division);

  const query: ListLicensesParams = {};
  if (search) query.search = search;
  if (tool) query.tool = tool;
  if (hasAccessRaw) query.hasAccess = hasAccessRaw === 'true';
  if (department) query.department = department;
  if (division) query.division = division;

  const [employees, stats, tools, areas, divisions] = await Promise.all([
    safe(listLicenses(query)),
    safe(getLicenseStats()),
    safe(listLicenseTools()),
    safe(listActiveCatalogItems('areas')),
    safe(listActiveCatalogItems('divisions')),
  ]);

  const emptyStats: LicenseStats = { totalEmployeesWithLicenses: 0, byTool: [] };
  const emptyEmployees: LicenseEmployeeRow[] = [];
  const emptyTools: ToolCatalogItem[] = [];

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <LicensesScreen
        employees={employees ?? emptyEmployees}
        stats={stats ?? emptyStats}
        tools={tools ?? emptyTools}
        apiUnavailable={employees === null}
        filters={{
          search: search ?? '',
          tool: tool ?? '',
          hasAccess: hasAccessRaw ?? '',
          department: department ?? '',
          division: division ?? '',
        }}
        catalogs={{
          areas: areas ?? [],
          divisions: divisions ?? [],
        }}
      />
    </div>
  );
}
