import { errorKindOf, getMyTickets, type ErrorKind } from '@/lib/api';
import { SupportScreen } from './support-screen';

async function safe<T>(p: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await p, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SoportePage({ searchParams }: Props) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const statusFilter = rawStatus ?? '';

  const queryParams = statusFilter ? { status: statusFilter, limit: 50 } : { limit: 50 };
  const { data: page, errorKind } = await safe(getMyTickets(queryParams));

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <SupportScreen
        page={page ?? { data: [], nextCursor: null, total: 0 }}
        errorKind={errorKind}
        statusFilter={statusFilter}
      />
    </div>
  );
}
