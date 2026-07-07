import {
  errorKindOf,
  getProjectStats,
  listClients,
  listProjects,
  type ErrorKind,
  type ListProjectsParams,
} from '@/lib/api';
import { ProjectsScreen } from './projects-screen';

async function safe<T>(p: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await p, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

function asString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v || undefined;
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProyectosPage({ searchParams }: Props) {
  const params = await searchParams;

  const query: ListProjectsParams = { limit: 20 };
  const status = asString(params.status);
  const projectType = asString(params.projectType);
  const businessUnit = asString(params.businessUnit);
  const clientRecordId = asString(params.clientRecordId);
  const search = asString(params.search);
  const cursor = asString(params.cursor);

  if (status) query.status = status;
  if (projectType) query.projectType = projectType;
  if (businessUnit) query.businessUnit = businessUnit;
  if (clientRecordId) query.clientRecordId = clientRecordId;
  if (search) query.search = search;
  if (cursor) query.cursor = cursor;

  const [pageResult, clientsResult, statsResult] = await Promise.all([
    safe(listProjects(query)),
    safe(listClients({ status: 'active', limit: 100 })),
    safe(getProjectStats()),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <ProjectsScreen
        page={pageResult.data ?? { data: [], nextCursor: null, total: 0 }}
        clients={clientsResult.data?.data ?? []}
        errorKind={pageResult.errorKind}
        filters={{ status: status ?? '', projectType: projectType ?? '', businessUnit: businessUnit ?? '', search: search ?? '' }}
        cursor={cursor ?? ''}
        activeCount={statsResult.data?.active ?? null}
      />
    </div>
  );
}
