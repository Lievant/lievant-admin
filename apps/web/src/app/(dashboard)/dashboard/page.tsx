import { ModuleCard } from '@/components/module-card';
import { getCurrentUser, type CurrentUser } from '@/lib/api';
import { modulesForRoles } from '@/lib/modules';

export default async function DashboardPage() {
  let user: CurrentUser | null = null;

  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  const roleNames = user?.roles.map((role) => role.name) ?? [];
  const modules = modulesForRoles(roleNames);
  const firstName = user?.name.split(' ')[0] ?? 'Invitado';

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header>
        <h1 className="text-2xl font-bold text-navy">Hola, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona un módulo para comenzar a trabajar.
        </p>
      </header>

      {!user && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo verificar tu sesión con la API ({process.env.NEXT_PUBLIC_API_URL}). Mostrando
          una vista previa con todos los módulos.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <ModuleCard key={mod.id} module={mod} />
        ))}
      </div>
    </div>
  );
}
