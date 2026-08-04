import { ComingSoonBadge, ModuleCard, StatCard } from '@/components/dashboard-cards';
import { BroadcastIcon, SpeakerphoneIcon } from '@/components/icons';

export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Marketing</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
        </div>
        <ComingSoonBadge />
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Campañas activas" value="—" href="/marketing" description="En ejecución" />
        <StatCard label="Leads del mes" value="—" href="/marketing" description="Generados" />
        <StatCard label="Contenidos publicados" value="—" href="/marketing" description="Este mes" />
        <StatCard label="Alcance total" value="—" href="/marketing" description="Impresiones" />
      </div>

      {/* Module access */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModuleCard
            title="Campañas"
            description="Planificación y seguimiento de campañas"
            href="/marketing"
            icon={<SpeakerphoneIcon className="h-6 w-6" />}
            accentClass="bg-black/10 text-black"
          />
          <ModuleCard
            title="Contenido digital"
            description="Publicaciones, canales y calendario"
            href="/marketing"
            icon={<BroadcastIcon className="h-6 w-6" />}
            accentClass="bg-black/10 text-black"
          />
        </div>
      </div>
    </div>
  );
}
