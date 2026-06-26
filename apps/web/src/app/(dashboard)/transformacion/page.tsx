import { ComingSoonBadge, ModuleCard, StatCard } from '@/components/dashboard-cards';
import { CpuIcon, LayersIcon, LicenseIcon, TicketIcon } from '@/components/icons';

export default function TransformacionPage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">
            Transformación Digital
          </p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
        </div>
        <ComingSoonBadge />
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Licencias activas"
          value="—"
          href="/transformacion/licenciamientos"
          description="Software en uso"
        />
        <StatCard
          label="Tickets abiertos"
          value="—"
          href="/transformacion/tickets"
          description="Soporte TI"
        />
        <StatCard
          label="Ítems en inventario"
          value="—"
          href="/transformacion/inventario"
          description="Activos registrados"
        />
        <StatCard
          label="Proyectos activos"
          value="—"
          href="/transformacion"
          description="En ejecución"
        />
      </div>

      {/* Module access */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModuleCard
            title="Licenciamientos"
            description="Software, suscripciones y renovaciones"
            href="/transformacion/licenciamientos"
            icon={<LicenseIcon className="h-6 w-6" />}
            accentClass="bg-blue-50 text-blue-600"
          />
          <ModuleCard
            title="Inventario TI"
            description="Equipos, activos y asignaciones"
            href="/transformacion/inventario"
            icon={<LayersIcon className="h-6 w-6" />}
            accentClass="bg-slate-100 text-slate-600"
          />
          <ModuleCard
            title="Tickets de soporte"
            description="Mesa de ayuda y seguimiento de incidencias"
            href="/transformacion/tickets"
            icon={<TicketIcon className="h-6 w-6" />}
            accentClass="bg-amber-50 text-amber-600"
          />
          <ModuleCard
            title="Proyectos digitales"
            description="Iniciativas y roadmap de transformación"
            href="/transformacion"
            icon={<CpuIcon className="h-6 w-6" />}
            accentClass="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>
    </div>
  );
}
