import { listClients, listProjects, type ListProjectsParams } from '@/lib/api';
import { ProjectsScreen } from './projects-screen';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
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

  const [page, clients] = await Promise.all([
    safe(listProjects(query)),
    safe(listClients({ status: 'active', limit: 100 })),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <ProjectsScreen
        page={page ?? { data: [], nextCursor: null, total: 0 }}
        clients={clients?.data ?? []}
        apiUnavailable={page === null}
        filters={{ status: status ?? '', projectType: projectType ?? '', businessUnit: businessUnit ?? '', search: search ?? '' }}
        cursor={cursor ?? ''}
      />
    </div>
  );
}
