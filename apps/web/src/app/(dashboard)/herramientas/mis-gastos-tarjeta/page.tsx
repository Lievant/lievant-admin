import { errorKindOf, getMyCardReports, type CardExpenseReportItem, type ErrorKind } from '@/lib/api';
import { MyCardReportsScreen } from './my-card-reports-screen';

export default async function MisGastosTarjetaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let reports: CardExpenseReportItem[] = [];
  let errorKind: ErrorKind | null = null;

  try {
    const page = await getMyCardReports({ ...(status ? { status } : {}), limit: 100 });
    reports = page.items;
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <MyCardReportsScreen reports={reports} errorKind={errorKind} activeStatus={status ?? ''} />
    </div>
  );
}
