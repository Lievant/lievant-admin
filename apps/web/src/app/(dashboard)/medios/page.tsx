import { errorKindOf, getMediaSummary, type ErrorKind, type MediaSummary } from '@/lib/api';
import { MediaDashboardScreen } from './media-dashboard-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function MediosPage() {
  const { data, errorKind } = await safe<MediaSummary>(getMediaSummary());

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <MediaDashboardScreen summary={data} errorKind={errorKind} />
    </div>
  );
}
