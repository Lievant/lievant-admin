import { listRoles, listUsers } from '@/lib/api';
import { UsersScreen } from './users-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function UsersPage() {
  const [users, roles] = await Promise.all([safe(listUsers()), safe(listRoles())]);

  const apiUnavailable = users === null;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <UsersScreen users={users ?? []} roles={roles ?? []} apiUnavailable={apiUnavailable} />
    </div>
  );
}
