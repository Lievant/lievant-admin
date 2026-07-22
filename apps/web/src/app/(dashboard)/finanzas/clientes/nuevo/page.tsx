import { listUsers } from '@/lib/api';
import { NewClientForm } from './new-client-form';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function NewClientPage() {
  const accountManagers = await safe(listUsers());

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <NewClientForm accountManagers={accountManagers ?? []} />
    </div>
  );
}
