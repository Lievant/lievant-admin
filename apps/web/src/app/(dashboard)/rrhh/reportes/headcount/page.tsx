import {
  errorKindOf,
  getHeadcountReport,
  type ErrorKind,
  type HeadcountReport,
  type HeadcountStatusFilter,
} from '@/lib/api';
import { HeadcountScreen } from './headcount-screen';

const ESTADOS: HeadcountStatusFilter[] = ['true', 'false', 'todos'];

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}

function asList(v: string | string[] | undefined): string[] | undefined {
  const s = asString(v);
  const list = s?.split(',').map((x) => x.trim()).filter(Boolean);
  return list?.length ? list : undefined;
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HeadcountPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawEstado = asString(params.activo);
  const activo = ESTADOS.includes(rawEstado as HeadcountStatusFilter)
    ? (rawEstado as HeadcountStatusFilter)
    : undefined;

  let report: HeadcountReport | null = null;
  let errorKind: ErrorKind | null = null;
  try {
    report = await getHeadcountReport({
      empresa: asList(params.empresa),
      activo,
      division: asString(params.division),
      ubicacion: asString(params.ubicacion),
      columns: asList(params.columns),
    });
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <HeadcountScreen report={report} errorKind={errorKind} />
    </div>
  );
}
