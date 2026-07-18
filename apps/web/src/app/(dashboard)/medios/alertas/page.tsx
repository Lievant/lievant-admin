import {
  errorKindOf,
  listMediaAlerts,
  type ErrorKind,
  type MediaAlertItem,
} from '@/lib/api';
import { AlertsScreen } from './alerts-screen';

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

interface AlertsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AlertasPage({ searchParams }: AlertsPageProps) {
  const sp = await searchParams;
  const status = asString(sp.status) ?? 'active';
  const severity = asString(sp.severity);

  const params: { status?: string; severity?: string } = {};
  if (status) params.status = status;
  if (severity) params.severity = severity;

  const { data, errorKind } = await safe<MediaAlertItem[]>(listMediaAlerts(params));

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AlertsScreen
        alerts={data ?? []}
        errorKind={errorKind}
        filters={{ status, severity: severity ?? '' }}
      />
    </div>
  );
}
