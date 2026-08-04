import { ModuleCard, StatCard } from '@/components/dashboard-cards';
import { PeopleIcon, ReportsIcon } from '@/components/icons';
import { getBirthdayReport, getExpiringContracts, listEmployees } from '@/lib/api';

export default async function RrhhPage() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;

  const [activeEmployeesResult, birthdaysResult, expiringResult] = await Promise.allSettled([
    listEmployees({ status: 'active', limit: 1 }),
    getBirthdayReport(currentMonth, 'date'),
    getExpiringContracts(30),
  ]);

  const activeEmployees =
    activeEmployeesResult.status === 'fulfilled' ? activeEmployeesResult.value.stats.active : null;
  const birthdaysThisMonth =
    birthdaysResult.status === 'fulfilled' ? birthdaysResult.value.length : null;
  const expiringContracts =
    expiringResult.status === 'fulfilled' ? expiringResult.value.length : null;
  const newHiresThisMonth =
    activeEmployeesResult.status === 'fulfilled' ? activeEmployeesResult.value.stats.newHires : null;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH</p>
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
            accentClass="bg-black/10 text-black"
          />
          <ModuleCard
            title="Reportes"
            description="Análisis de plantilla y estadísticas"
            href="/rrhh/reportes"
            icon={<ReportsIcon className="h-6 w-6" />}
            accentClass="bg-black/10 text-black"
          />
        </div>
      </div>
    </div>
  );
}
