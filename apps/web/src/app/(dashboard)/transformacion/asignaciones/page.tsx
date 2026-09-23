import {
  errorKindOf,
  getCostReport,
  listAssigners,
  listAssignmentAreas,
  listAssignments,
  listTools,
  type AssignmentsPage,
  type CostReport,
  type ErrorKind,
  type ListAssignmentsParams,
} from '@/lib/api';
import { AssignmentsScreen } from './assignments-screen';

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

type TabKey = 'resumen' | 'asignaciones' | 'configuracion';

interface AsignacionesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AsignacionesPage({ searchParams }: AsignacionesPageProps) {
  const params = await searchParams;

  const rawTab = asString(params.tab);
  const tab: TabKey =
    rawTab === 'asignaciones' || rawTab === 'configuracion' ? rawTab : 'resumen';

  const search = asString(params.search);
  const status = asString(params.status);
  const toolId = asString(params.toolId);
  const area = asString(params.area);
  const cursor = asString(params.cursor);

  const query: ListAssignmentsParams = {};
  if (search) query.search = search;
  if (status) query.status = status;
  if (toolId) query.toolId = toolId;
  if (area) query.area = area;
  if (cursor) query.cursor = cursor;

  // El reporte del tab Resumen se precarga con el rango por defecto —del
  // inicio del año a hoy— y el cliente lo vuelve a pedir al aplicar filtros.
  const today = new Date();
  const defaultRange = {
    dateFrom: `${today.getFullYear()}-01-01`,
    dateTo: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  };

  const [assignmentsResult, reportResult, toolsResult, assignersResult, areasResult] =
    await Promise.all([
      safe(listAssignments(query)),
      safe(getCostReport(defaultRange)),
      safe(listTools()),
      safe(listAssigners()),
      safe(listAssignmentAreas()),
    ]);

  const emptyPage: AssignmentsPage = { data: [], nextCursor: null };
  const emptyReport: CostReport = {
    summary: {
      totalActiveLicenses: 0,
      totalMonthlyCostMXN: 0,
      totalMonthlyCostUSD: 0,
      totalAnnualCostMXN: 0,
      totalAnnualCostUSD: 0,
      costPerEmployeeMXN: 0,
      costPerEmployeeUSD: 0,
      totalEmployees: 0,
      totalTools: 0,
      totalAreas: 0,
    },
    byTool: [],
    byArea: [],
    byEmployee: [],
    timeline: [],
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AssignmentsScreen
        page={assignmentsResult.data ?? emptyPage}
        costReport={reportResult.data ?? emptyReport}
        tools={toolsResult.data ?? []}
        assigners={assignersResult.data ?? []}
        areas={areasResult.data ?? []}
        tab={tab}
        errorKind={assignmentsResult.errorKind}
        filters={{
          search: search ?? '',
          status: status ?? '',
          toolId: toolId ?? '',
          area: area ?? '',
        }}
      />
    </div>
  );
}
