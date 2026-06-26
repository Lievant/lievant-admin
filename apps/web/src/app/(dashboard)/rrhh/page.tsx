import { ModuleCard, StatCard } from '@/components/dashboard-cards';
import { IdCardIcon, PeopleIcon, ReportsIcon } from '@/components/icons';

export default function RrhhPage() {
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
          value="—"
          href="/rrhh/empleados"
          description="Headcount total"
        />
        <StatCard
          label="Cumpleaños este mes"
          value="—"
          href="/rrhh/empleados"
          description="Colaboradores"
        />
        <StatCard
          label="Contratos por vencer"
          value="—"
          href="/rrhh/empleados"
          description="Próximos 30 días"
        />
        <StatCard
          label="Nuevos ingresos"
          value="—"
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
            title="Documentos RRHH"
            description="Generación de contratos y convenios"
            href="/rrhh/empleados"
            icon={<IdCardIcon className="h-6 w-6" />}
            accentClass="bg-purple-50 text-purple-600"
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
