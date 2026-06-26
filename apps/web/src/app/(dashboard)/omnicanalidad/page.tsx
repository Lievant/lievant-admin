import { ComingSoonBadge, ModuleCard, StatCard } from '@/components/dashboard-cards';
import { BroadcastIcon, SitemapIcon } from '@/components/icons';

export default function OmnicanalidadPage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">
            Omnicanalidad
          </p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
        </div>
        <ComingSoonBadge />
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Canales activos" value="—" href="/omnicanalidad" description="Integrados" />
        <StatCard label="Tickets abiertos" value="—" href="/omnicanalidad" description="Sin resolver" />
        <StatCard label="Tiempo resp. promedio" value="—" href="/omnicanalidad" description="Horas" />
        <StatCard label="Satisfacción (CSAT)" value="—" href="/omnicanalidad" description="Índice del mes" />
      </div>

      {/* Module access */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModuleCard
            title="Canales"
            description="WhatsApp, correo, chat y redes sociales"
            href="/omnicanalidad"
            icon={<BroadcastIcon className="h-6 w-6" />}
            accentClass="bg-cyan-50 text-cyan-600"
          />
          <ModuleCard
            title="Integraciones"
            description="Configuración de plataformas conectadas"
            href="/omnicanalidad"
            icon={<SitemapIcon className="h-6 w-6" />}
            accentClass="bg-indigo-50 text-indigo-600"
          />
        </div>
      </div>
    </div>
  );
}
