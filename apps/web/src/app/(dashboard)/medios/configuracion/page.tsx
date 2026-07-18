import {
  errorKindOf,
  getMediaAuditLog,
  listMediaPlatforms,
  type ErrorKind,
  type MediaAuditEntry,
  type MediaPlatform,
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
  const [platformsResult, auditResult] = await Promise.all([
    safe<MediaPlatform[]>(listMediaPlatforms()),
    safe<MediaAuditEntry[]>(getMediaAuditLog({ limit: 50 })),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <MediaConfigScreen
        platforms={platformsResult.data ?? []}
        auditLog={auditResult.data ?? []}
        errorKind={platformsResult.errorKind}
      />
    </div>
  );
}
