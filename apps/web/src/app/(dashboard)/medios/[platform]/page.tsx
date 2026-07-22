import {
  errorKindOf,
  listMediaAccounts,
  listMediaPlatforms,
  type AccountPacingRow,
  type ErrorKind,
  type ListMediaAccountsParams,
  type MediaPlatform,
} from '@/lib/api';
import { PlatformScreen } from './platform-screen';

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

interface PlatformPageProps {
  params: Promise<{ platform: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlatformPage({ params, searchParams }: PlatformPageProps) {
  const { platform } = await params;
  const sp = await searchParams;

  const status = asString(sp.status);
  const month = asString(sp.month);
  const search = asString(sp.search);

  const query: ListMediaAccountsParams = { platform };
  if (status) query.status = status;
  if (month) query.month = month;
  if (search) query.search = search;

  const [accountsResult, platformsResult] = await Promise.all([
    safe<AccountPacingRow[]>(listMediaAccounts(query)),
    safe<MediaPlatform[]>(listMediaPlatforms()),
  ]);

  const platformMeta = platformsResult.data?.find((p) => p.slug === platform) ?? null;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <PlatformScreen
        slug={platform}
        platformMeta={platformMeta}
        accounts={accountsResult.data ?? []}
        errorKind={accountsResult.errorKind}
        filters={{ status: status ?? '', month: month ?? '', search: search ?? '' }}
      />
    </div>
  );
}
