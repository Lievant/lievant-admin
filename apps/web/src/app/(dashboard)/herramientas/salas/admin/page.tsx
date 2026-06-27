import { getLocationsTree, getRoomAdminScope, listPendingApprovals } from '@/lib/api';
import { AdminScreen } from './admin-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function SalasAdminPage() {
  const adminScope = await safe(getRoomAdminScope());
  const isAdmin = Boolean(adminScope?.isGlobalAdmin || (adminScope?.officeIds.length ?? 0) > 0);

  if (!adminScope || !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No tienes permisos de administrador de salas.
        </div>
      </div>
    );
  }

  const [locationsTree, pendingApprovals] = await Promise.all([
    safe(getLocationsTree()),
    safe(listPendingApprovals()),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AdminScreen
        isGlobalAdmin={adminScope.isGlobalAdmin}
        officeIds={adminScope.officeIds}
        locationsTree={locationsTree ?? []}
        apiUnavailable={locationsTree === null}
        pendingApprovals={pendingApprovals ?? []}
      />
    </div>
  );
}
