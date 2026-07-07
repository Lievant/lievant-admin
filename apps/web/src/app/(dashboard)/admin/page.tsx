import { StatCard } from '@/components/stat-card';
import { errorKindOf, listRoles, listUsers, type ErrorKind } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function AdminPage() {
  const [usersResult, rolesResult] = await Promise.all([safe(listUsers()), safe(listRoles())]);
  const users = usersResult.data;
  const roles = rolesResult.data;

  const totalUsers = users?.length ?? null;
  const totalRoles = roles?.length ?? null;
  const pendingUsers = users?.filter((user) => !user.isActive).length ?? null;

  if (usersResult.errorKind === 'forbidden' && rolesResult.errorKind === 'forbidden') {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10">
        <NoPermissions />
      </div>
    );
  }

  const apiUnavailable = users === null && roles === null;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header>
        <h1 className="text-2xl font-bold text-navy">Panel de administración</h1>
        <p className="mt-1 text-sm text-slate-500">
          Resumen general de usuarios, roles y actividad del sistema.
        </p>
      </header>

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API ({process.env.NEXT_PUBLIC_API_URL}). Inicia sesión como
          administrador para ver datos en vivo.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Usuarios" value={totalUsers ?? '—'} hint="Total registrados" />
        <StatCard label="Roles" value={totalRoles ?? '—'} hint="Roles del sistema" />
        <StatCard label="Pendientes" value={pendingUsers ?? '—'} hint="Usuarios inactivos" />
        <StatCard label="Sesiones activas" value="—" hint="Próximamente" />
      </div>
    </div>
  );
}
