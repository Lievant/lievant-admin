import { notFound } from 'next/navigation';
import { errorKindOf, getMediaAccount, type ErrorKind, type MediaAccountDetail } from '@/lib/api';
import { AccountDetailScreen } from './account-detail-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;
  const { data, errorKind } = await safe<MediaAccountDetail>(getMediaAccount(id));

  if (!data && errorKind !== 'forbidden' && errorKind !== 'unavailable') {
    notFound();
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AccountDetailScreen detail={data} errorKind={errorKind} />
    </div>
  );
}
