import { errorKindOf, listRoles, listUsers, type ErrorKind } from '@/lib/api';
import { UsersScreen } from './users-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function UsersPage() {
  const [usersResult, rolesResult] = await Promise.all([safe(listUsers()), safe(listRoles())]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <UsersScreen users={usersResult.data ?? []} roles={rolesResult.data ?? []} errorKind={usersResult.errorKind} />
    </div>
  );
}
