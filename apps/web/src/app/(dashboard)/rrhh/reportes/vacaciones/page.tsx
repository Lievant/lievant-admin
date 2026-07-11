import { getVacationReport, type VacationReportRow } from '@/lib/api';
import { VacationReportScreen } from './vacation-report-screen';

function firstDayOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lastDayOfMonth(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VacacionesReportPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const startDate = (Array.isArray(params.startDate) ? params.startDate[0] : params.startDate) ?? firstDayOfMonth(now);
  const endDate = (Array.isArray(params.endDate) ? params.endDate[0] : params.endDate) ?? lastDayOfMonth(now);

  let rows: VacationReportRow[] = [];
  try {
    rows = await getVacationReport(startDate, endDate);
  } catch {
    rows = [];
  }

  return <VacationReportScreen rows={rows} startDate={startDate} endDate={endDate} />;
}
