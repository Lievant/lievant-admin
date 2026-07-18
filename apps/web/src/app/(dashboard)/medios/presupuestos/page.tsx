import {
  errorKindOf,
  listMediaAccounts,
  listMediaBudgets,
  type AccountPacingRow,
  type ErrorKind,
  type MediaBudgetItem,
} from '@/lib/api';
import { BudgetsScreen } from './budgets-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

interface BudgetsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PresupuestosPage({ searchParams }: BudgetsPageProps) {
  const sp = await searchParams;
  const month = asString(sp.month);

  const [budgetsResult, accountsResult] = await Promise.all([
    safe<MediaBudgetItem[]>(listMediaBudgets(month ? { month } : {})),
    safe<AccountPacingRow[]>(listMediaAccounts({})),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <BudgetsScreen
        budgets={budgetsResult.data ?? []}
        accounts={accountsResult.data ?? []}
        errorKind={budgetsResult.errorKind}
        filters={{ month: month ?? '' }}
      />
    </div>
  );
}
