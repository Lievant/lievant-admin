import { errorKindOf, getAllExpenseReports, type ErrorKind, type ExpenseReportItem } from '@/lib/api';
import { ExpenseReportsFinanceScreen } from './expense-reports-finance-screen';

export default async function FinanzasReembolsosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; requester?: string }>;
}) {
  const { status, requester } = await searchParams;

  let reports: ExpenseReportItem[] = [];
  let errorKind: ErrorKind | null = null;

  try {
    const page = await getAllExpenseReports({
      ...(status ? { status } : {}),
      ...(requester ? { requester } : {}),
      limit: 100,
    });
    reports = page.items;
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <ExpenseReportsFinanceScreen
        reports={reports}
        errorKind={errorKind}
        activeStatus={status ?? ''}
        activeRequester={requester ?? ''}
      />
    </div>
  );
}
