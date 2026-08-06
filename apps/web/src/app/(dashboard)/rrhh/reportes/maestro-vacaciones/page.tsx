import {
  errorKindOf,
  getVacationMasterReport,
  type AnniversaryWindow,
  type ErrorKind,
  type VacationMasterRow,
} from '@/lib/api';
import { VacationMasterReportScreen } from './vacation-master-report-screen';

const VENTANAS: AnniversaryWindow[] = ['week', 'month', 'quarter'];

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MaestroVacacionesPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = asString(params.search);
  const raw = asString(params.anniversary_within);
  const anniversaryWithin = VENTANAS.includes(raw as AnniversaryWindow)
    ? (raw as AnniversaryWindow)
    : undefined;

  let rows: VacationMasterRow[] = [];
  let errorKind: ErrorKind | null = null;
  try {
    rows = await getVacationMasterReport({
      ...(search ? { search } : {}),
      ...(anniversaryWithin ? { anniversaryWithin } : {}),
    });
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <VacationMasterReportScreen
        rows={rows}
        errorKind={errorKind}
        search={search ?? ''}
        anniversaryWithin={anniversaryWithin ?? ''}
      />
    </div>
  );
}
