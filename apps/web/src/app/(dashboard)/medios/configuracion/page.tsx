import {
  errorKindOf,
  getMediaAuditLog,
  getMediaSyncLogs,
  listMediaAccounts,
  listMediaCredentials,
  listMediaPlatforms,
  type AccountPacingRow,
  type ErrorKind,
  type MediaAuditEntry,
  type MediaCredential,
  type MediaPlatform,
  type MediaSyncLog,
} from '@/lib/api';
import { MediaConfigScreen } from './media-config-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function ConfiguracionPage() {
  const [platformsResult, credentialsResult, accountsResult, syncLogsResult, auditResult] =
    await Promise.all([
      safe<MediaPlatform[]>(listMediaPlatforms()),
      safe<MediaCredential[]>(listMediaCredentials({ includeInactive: true })),
      safe<AccountPacingRow[]>(listMediaAccounts({})),
      safe<MediaSyncLog[]>(getMediaSyncLogs({ limit: 100 })),
      safe<MediaAuditEntry[]>(getMediaAuditLog({ limit: 50 })),
    ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <MediaConfigScreen
        platforms={platformsResult.data ?? []}
        credentials={credentialsResult.data ?? []}
        accounts={accountsResult.data ?? []}
        syncLogs={syncLogsResult.data ?? []}
        auditLog={auditResult.data ?? []}
        errorKind={platformsResult.errorKind}
        credentialsForbidden={credentialsResult.errorKind === 'forbidden'}
      />
    </div>
  );
}
