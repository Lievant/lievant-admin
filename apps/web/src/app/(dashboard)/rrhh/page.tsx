import { ModuleCard, StatCard } from '@/components/dashboard-cards';
import { PeopleIcon, ReportsIcon } from '@/components/icons';
import { getBirthdayReport, getExpiringContracts, listEmployees } from '@/lib/api';

export default async function RrhhPage() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;

  const [activeEmployeesResult, birthdaysResult, expiringResult, newHiresResult] = await Promise.allSettled([
    listEmployees({ status: 'active', limit: 1 }),
    getBirthdayReport(currentMonth, 'date'),
    getExpiringContracts(30),
    listEmployees({ limit: 100 }),
  ]);

  const activeEmployees =
    activeEmployeesResult.status === 'fulfilled' ? activeEmployeesResult.value.stats.active : null;
  const birthdaysThisMonth =
    birthdaysResult.status === 'fulfilled' ? birthdaysResult.value.length : null;
  const expiringContracts =
    expiringResult.status === 'fulfilled' ? expiringResult.value.length : null;

  const newHiresThisMonth =
    newHiresResult.status === 'fulfilled'
      ? newHiresResult.value.data.filter((e) => {
          const created = new Date(e.createdAt);
          return created.getFullYear() === today.getFullYear() && created.getMonth() === today.getMonth();
        }).length
      : null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-terracota">RRHH</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Empleados activos"
          value={activeEmployees ?? '—'}
          href="/rrhh/empleados?status=active"
          description="Headcount total"
        />
        <StatCard
          label="Cumpleaños este mes"
          value={birthdaysThisMonth ?? '—'}
          href="/rrhh/reportes/cumpleanos"
          description="Colaboradores"
        />
        <StatCard
          label="Contratos por vencer"
          value={expiringContracts ?? '—'}
          href="/rrhh/reportes/contratos"
          description="Próximos 30 días"
        />
        <StatCard
          label="Nuevos ingresos"
          value={newHiresThisMonth ?? '—'}
          href="/rrhh/empleados"
          description="Este mes"
        />
      </div>

      {/* Module access */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModuleCard
            title="Empleados"
            description="Directorio, contratos y datos del colaborador"
            href="/rrhh/empleados"
            icon={<PeopleIcon className="h-6 w-6" />}
            accentClass="bg-terracota/10 text-terracota"
          />
          <ModuleCard
            title="Reportes"
            description="Análisis de plantilla y estadísticas"
            href="/rrhh/reportes"
            icon={<ReportsIcon className="h-6 w-6" />}
            accentClass="bg-blue-50 text-blue-600"
          />
        </div>
      </div>
    </div>
  );
}
