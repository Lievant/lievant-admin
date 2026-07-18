import {
  errorKindOf,
  listMediaAccounts,
  listMediaPlatforms,
  type AccountPacingRow,
  type ErrorKind,
  type ListMediaAccountsParams,
  type MediaPlatform,
} from '@/lib/api';
import { AccountsScreen } from './accounts-screen';

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

interface AccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CuentasPage({ searchParams }: AccountsPageProps) {
  const sp = await searchParams;
  const platform = asString(sp.platform);
  const status = asString(sp.status);
  const search = asString(sp.search);

  const query: ListMediaAccountsParams = {};
  if (platform) query.platform = platform;
  if (status) query.status = status;
  if (search) query.search = search;

  const [accountsResult, platformsResult] = await Promise.all([
    safe<AccountPacingRow[]>(listMediaAccounts(query)),
    safe<MediaPlatform[]>(listMediaPlatforms()),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AccountsScreen
        accounts={accountsResult.data ?? []}
        platforms={platformsResult.data ?? []}
        errorKind={accountsResult.errorKind}
        filters={{ platform: platform ?? '', status: status ?? '', search: search ?? '' }}
      />
    </div>
  );
}
