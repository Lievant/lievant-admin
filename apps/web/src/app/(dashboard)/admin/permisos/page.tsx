import { listAllPermissions, listRolesWithPermissions, listUsers } from '@/lib/api';
import { PermissionsScreen } from './permissions-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function PermisosPage() {
  const [roles, permissions, users] = await Promise.all([
    safe(listRolesWithPermissions()),
    safe(listAllPermissions()),
    safe(listUsers()),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PermissionsScreen
        roles={roles ?? []}
        permissions={permissions ?? []}
        users={users ?? []}
      />
    </div>
  );
}
