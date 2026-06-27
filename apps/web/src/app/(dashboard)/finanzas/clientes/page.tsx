import { listActiveCatalogItems, listClients, type ClientStatus, type DocStatus, type ListClientsParams } from '@/lib/api';
import { ClientsScreen } from './clients-screen';

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

interface ClientesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const params = await searchParams;

  const cursor = asString(params.cursor);
  const status = asString(params.status) as ClientStatus | undefined;
  const docStatus = asString(params.docStatus) as DocStatus | undefined;
  const industry = asString(params.industry);
  const search = asString(params.search);
  const cursors = asString(params.cursors);

  const query: ListClientsParams = { limit: 10 };
  if (cursor) query.cursor = cursor;
  if (status) query.status = status;
  if (docStatus) query.docStatus = docStatus;
  if (industry) query.industry = industry;
  if (search) query.search = search;

  const [clientsPage, industries] = await Promise.all([
    safe(listClients(query)),
    safe(listActiveCatalogItems('industries')),
  ]);

  const apiUnavailable = clientsPage === null;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <ClientsScreen
        page={clientsPage ?? { data: [], nextCursor: null, total: 0 }}
        industries={industries ?? []}
        apiUnavailable={apiUnavailable}
        filters={{ status: status ?? '', docStatus: docStatus ?? '', industry: industry ?? '', search: search ?? '' }}
        cursor={cursor ?? ''}
        cursorsStack={cursors ? cursors.split(',').filter(Boolean) : []}
      />
    </div>
  );
}
