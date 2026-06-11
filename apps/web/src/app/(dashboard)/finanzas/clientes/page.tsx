import { listClients, listUsers, type ClientStatus, type ListClientsParams } from '@/lib/api';
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
  const accountManagerId = asString(params.accountManagerId);
  const industry = asString(params.industry);
  const search = asString(params.search);
  const cursors = asString(params.cursors);

  const query: ListClientsParams = { limit: 10 };
  if (cursor) query.cursor = cursor;
  if (status) query.status = status;
  if (accountManagerId) query.accountManagerId = accountManagerId;
  if (industry) query.industry = industry;
  if (search) query.search = search;

  const [clientsPage, accountManagers] = await Promise.all([
    safe(listClients(query)),
    safe(listUsers()),
  ]);

  const apiUnavailable = clientsPage === null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <ClientsScreen
        page={clientsPage ?? { data: [], nextCursor: null }}
        accountManagers={accountManagers ?? []}
        apiUnavailable={apiUnavailable}
        filters={{ status: status ?? '', accountManagerId: accountManagerId ?? '', industry: industry ?? '', search: search ?? '' }}
        cursor={cursor ?? ''}
        cursorsStack={cursors ? cursors.split(',').filter(Boolean) : []}
      />
    </div>
  );
}
