import { getCurrentUser, getHelpdeskCategories, listTickets, type ListTicketsParams } from '@/lib/api';
import { TicketsScreen } from './tickets-screen';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const status = asString(sp.status);
  const priority = asString(sp.priority);
  const category = asString(sp.category);
  const search = asString(sp.search);
  const slaStatus = asString(sp.slaStatus) as 'ok' | 'warning' | 'overdue' | undefined;
  const cursor = asString(sp.cursor);
  const cursors = asString(sp.cursors);

  const query: ListTicketsParams = { limit: 20 };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category) query.category = category;
  if (search) query.search = search;
  if (slaStatus) query.slaStatus = slaStatus;
  if (cursor) query.cursor = cursor;

  const [ticketPage, categories, currentUser] = await Promise.all([
    safe(listTickets(query)),
    safe(getHelpdeskCategories()),
    safe(getCurrentUser()),
  ]);

  const isTd =
    currentUser?.roles.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'TECNICO_TD') ||
    currentUser?.permissions.some((p) => p.module === 'tickets.gestion') ||
    false;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <TicketsScreen
        page={ticketPage ?? { data: [], nextCursor: null, total: 0 }}
        categories={categories ?? []}
        isTd={isTd}
        filters={{ status: status ?? '', priority: priority ?? '', category: category ?? '', search: search ?? '', slaStatus: slaStatus ?? '' }}
        cursor={cursor ?? ''}
        cursorsStack={cursors ? cursors.split(',').filter(Boolean) : []}
        apiUnavailable={ticketPage === null}
      />
    </div>
  );
}
