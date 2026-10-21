import {
  errorKindOf,
  getSimCardStats,
  listSimCards,
  listSimPlans,
  type ErrorKind,
  type ListSimCardsParams,
  type SimCardPage,
  type SimCardStats,
} from '@/lib/api';
import { SimCardsScreen } from './sim-cards-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
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

interface SimCardsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SimCardsPage({ searchParams }: SimCardsPageProps) {
  const params = await searchParams;

  const cursor = asString(params.cursor);
  const cursors = asString(params.cursors);
  const search = asString(params.search);
  const status = asString(params.status);
  const planId = asString(params.planId);
  const providerId = asString(params.providerId);
  const assignment = asString(params.assignment); // 'sin_asignar' | 'asignada'
  const expiry = asString(params.expiry);

  const query: ListSimCardsParams = { limit: 20 };
  if (cursor) query.cursor = cursor;
  if (search) query.search = search;
  if (status) query.status = status;
  if (planId) query.planId = planId;
  if (providerId) query.providerId = providerId;
  if (assignment === 'sin_asignar') query.unassigned = true;
  if (assignment === 'asignada') query.assigned = true;
  if (expiry) query.expiry = expiry;

  const [pageResult, statsResult, plansResult] = await Promise.all([
    safe(listSimCards(query)),
    safe(getSimCardStats()),
    safe(listSimPlans()),
  ]);

  const emptyPage: SimCardPage = { data: [], nextCursor: null, total: 0 };
  const emptyStats: SimCardStats = {
    active: 0,
    unassigned: 0,
    expiring: 0,
    expired: 0,
    monthlyCostMXN: 0,
    monthlyCostUSD: 0,
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <SimCardsScreen
        page={pageResult.data ?? emptyPage}
        stats={statsResult.data ?? emptyStats}
        plans={plansResult.data ?? []}
        errorKind={pageResult.errorKind}
        filters={{
          search: search ?? '',
          status: status ?? '',
          planId: planId ?? '',
          providerId: providerId ?? '',
          assignment: assignment ?? '',
          expiry: expiry ?? '',
        }}
        cursor={cursor ?? ''}
        cursorsStack={cursors ? cursors.split(',').filter(Boolean) : []}
      />
    </div>
  );
}
