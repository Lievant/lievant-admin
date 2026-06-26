import { getBirthdayReport } from '@/lib/api';
import type { BirthdayReportItem } from '@/lib/api';
import { BirthdayReportScreen } from './birthday-report-screen';

interface PageProps {
  searchParams: Promise<{ month?: string; orderBy?: string }>;
}

function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  return p.catch(() => fallback);
}

export default async function CumpleanosPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const rawMonth = sp.month ? parseInt(sp.month, 10) : new Date().getMonth() + 1;
  const month = isNaN(rawMonth) || rawMonth < 1 || rawMonth > 12 ? new Date().getMonth() + 1 : rawMonth;
  const orderBy: 'date' | 'name' | 'area' =
    sp.orderBy === 'name' || sp.orderBy === 'area' ? sp.orderBy : 'date';

  const items = await safe(getBirthdayReport(month, orderBy), [] as BirthdayReportItem[]);

  return <BirthdayReportScreen items={items} selectedMonth={month} selectedOrderBy={orderBy} />;
}
