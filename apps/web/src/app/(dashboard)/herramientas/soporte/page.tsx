import { getMyTickets } from '@/lib/api';
import { SupportScreen } from './support-screen';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SoportePage({ searchParams }: Props) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const statusFilter = rawStatus ?? '';

  const queryParams = statusFilter ? { status: statusFilter, limit: 50 } : { limit: 50 };
  const page = await safe(getMyTickets(queryParams));

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <SupportScreen
        page={page ?? { data: [], nextCursor: null, total: 0 }}
        apiUnavailable={page === null}
        statusFilter={statusFilter}
      />
    </div>
  );
}
