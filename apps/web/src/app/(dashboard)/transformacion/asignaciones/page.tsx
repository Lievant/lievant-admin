import {
  errorKindOf,
  getAssignmentStats,
  listAssigners,
  listAssignments,
  listTools,
  type AssignmentsPage,
  type AssignmentStats,
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
  const cursor = asString(params.cursor);

  const query: ListAssignmentsParams = {};
  if (search) query.search = search;
  if (status) query.status = status;
  if (toolId) query.toolId = toolId;
  if (cursor) query.cursor = cursor;

  const [assignmentsResult, statsResult, toolsResult, assignersResult] = await Promise.all([
    safe(listAssignments(query)),
    safe(getAssignmentStats()),
    safe(listTools()),
    safe(listAssigners()),
  ]);

  const emptyPage: AssignmentsPage = { data: [], nextCursor: null };
  const emptyStats: AssignmentStats = {
    totalActive: 0,
    totalRevoked: 0,
    unusedOver60Days: 0,
    byTool: [],
    byArea: [],
    recentAssignments: [],
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AssignmentsScreen
        page={assignmentsResult.data ?? emptyPage}
        stats={statsResult.data ?? emptyStats}
        tools={toolsResult.data ?? []}
        assigners={assignersResult.data ?? []}
        tab={tab}
        errorKind={assignmentsResult.errorKind}
        filters={{
          search: search ?? '',
          status: status ?? '',
          toolId: toolId ?? '',
        }}
      />
    </div>
  );
}
