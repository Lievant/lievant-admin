import { ModuleCard, StatCard } from '@/components/dashboard-cards';
import { BuildingIcon, ReportMoneyIcon, TruckIcon } from '@/components/icons';

export default function FinanzasPage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-terracota">Finanzas</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Clientes activos"
          value="—"
          href="/finanzas/clientes"
          description="Total en cartera"
        />
        <StatCard
          label="Facturas pendientes"
          value="—"
          href="/finanzas/proveedores"
          description="Por liquidar"
        />
        <StatCard
          label="OC abiertas"
          value="—"
          href="/finanzas/proveedores"
          description="Órdenes de compra"
        />
        <StatCard
          label="Proveedores activos"
          value="—"
          href="/finanzas/proveedores"
          description="En padrón"
        />
      </div>

      {/* Module access */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModuleCard
            title="Clientes"
            description="Cartera de clientes, contratos y contactos"
            href="/finanzas/clientes"
            icon={<BuildingIcon className="h-6 w-6" />}
            accentClass="bg-blue-50 text-blue-600"
          />
          <ModuleCard
            title="Proveedores"
            description="Padrón, órdenes de compra y facturas"
            href="/finanzas/proveedores"
            icon={<TruckIcon className="h-6 w-6" />}
            accentClass="bg-amber-50 text-amber-600"
          />
          <ModuleCard
            title="Reportes financieros"
            description="Estados de cuenta y resúmenes"
            href="/finanzas/reportes"
            icon={<ReportMoneyIcon className="h-6 w-6" />}
            accentClass="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>
    </div>
  );
}
