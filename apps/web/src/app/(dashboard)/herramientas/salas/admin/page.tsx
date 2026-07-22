import { errorKindOf, getLocationsTree, getRoomAdminScope, listPendingApprovals, type ErrorKind } from '@/lib/api';
import { AdminScreen } from './admin-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function SalasAdminPage() {
  const adminScope = (await safe(getRoomAdminScope())).data;
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

  const [locationsTreeResult, pendingApprovalsResult] = await Promise.all([
    safe(getLocationsTree()),
    safe(listPendingApprovals()),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AdminScreen
        isGlobalAdmin={adminScope.isGlobalAdmin}
        officeIds={adminScope.officeIds}
        locationsTree={locationsTreeResult.data ?? []}
        errorKind={locationsTreeResult.errorKind}
        pendingApprovals={pendingApprovalsResult.data ?? []}
      />
    </div>
  );
}
