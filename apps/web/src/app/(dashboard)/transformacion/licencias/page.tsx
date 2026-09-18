import {
  errorKindOf,
  getLicenseModuleStats,
  listActiveCatalogItems,
  listLicenseRecords,
  listTools,
  type ErrorKind,
  type LicenseModuleStats,
  type LicensesPage,
  type ListLicenseRecordsParams,
} from '@/lib/api';
import { LicensesScreen } from './licenses-screen';

async function safe<T>(
  promise: Promise<T>,
): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

type TabKey = 'resumen' | 'licencias' | 'colaborador';

interface LicenciasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LicenciasPage({ searchParams }: LicenciasPageProps) {
  const params = await searchParams;

  const rawTab = asString(params.tab);
  const tab: TabKey =
    rawTab === 'licencias' || rawTab === 'colaborador' ? rawTab : 'resumen';

  const search = asString(params.search);
  const toolId = asString(params.toolId);
  const businessUnit = asString(params.businessUnit);
  const status = asString(params.status);
  const currency = asString(params.currency);
  const pageParam = Number(asString(params.page) ?? '1');

  const query: ListLicenseRecordsParams = {
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
  };
  if (search) query.search = search;
  if (toolId) query.toolId = toolId;
  if (businessUnit) query.businessUnit = businessUnit;
  if (status) query.status = status;
  if (currency) query.currency = currency;

  const [licensesResult, statsResult, toolsResult, areasResult] = await Promise.all([
    safe(listLicenseRecords(query)),
    safe(getLicenseModuleStats()),
    safe(listTools()),
    safe(listActiveCatalogItems('areas')),
  ]);

  const emptyPage: LicensesPage = { data: [], total: 0, page: 1, limit: 50, totalPages: 1 };
  const emptyStats: LicenseModuleStats = {
    totalLicenses: 0,
    activeLicenses: 0,
    totalCostMXN: 0,
    totalCostUSD: 0,
    byBusinessUnit: [],
    byTool: [],
    expiringIn30Days: 0,
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <LicensesScreen
        page={licensesResult.data ?? emptyPage}
        stats={statsResult.data ?? emptyStats}
        tools={toolsResult.data ?? []}
        businessUnits={(areasResult.data ?? []).map((a) => a.name)}
        tab={tab}
        errorKind={licensesResult.errorKind}
        filters={{
          search: search ?? '',
          toolId: toolId ?? '',
          businessUnit: businessUnit ?? '',
          status: status ?? '',
          currency: currency ?? '',
        }}
      />
    </div>
  );
}
