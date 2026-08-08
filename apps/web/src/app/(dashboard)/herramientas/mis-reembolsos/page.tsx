import { errorKindOf, getMyExpenseReports, type ErrorKind, type ExpenseReportItem } from '@/lib/api';
import { MyExpenseReportsScreen } from './my-expense-reports-screen';

export default async function MisReembolsosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let reports: ExpenseReportItem[] = [];
  let errorKind: ErrorKind | null = null;

  try {
    const page = await getMyExpenseReports({ ...(status ? { status } : {}), limit: 100 });
    reports = page.items;
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <MyExpenseReportsScreen reports={reports} errorKind={errorKind} activeStatus={status ?? ''} />
    </div>
  );
}
