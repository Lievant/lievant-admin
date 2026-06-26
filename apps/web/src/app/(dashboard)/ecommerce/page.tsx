import { ComingSoonBadge, ModuleCard, StatCard } from '@/components/dashboard-cards';
import { ReportMoneyIcon, ShoppingCartIcon } from '@/components/icons';

export default function EcommercePage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Ecommerce</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
        </div>
        <ComingSoonBadge />
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pedidos hoy" value="—" href="/ecommerce" description="Órdenes recibidas" />
        <StatCard label="Ventas del mes" value="—" href="/ecommerce" description="MXN acumulado" />
        <StatCard label="Productos activos" value="—" href="/ecommerce" description="En catálogo" />
        <StatCard label="Devoluciones" value="—" href="/ecommerce" description="Pendientes de gestión" />
      </div>

      {/* Module access */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModuleCard
            title="Catálogo"
            description="Productos, precios e inventario"
            href="/ecommerce"
            icon={<ShoppingCartIcon className="h-6 w-6" />}
            accentClass="bg-emerald-50 text-emerald-600"
          />
          <ModuleCard
            title="Ventas y pedidos"
            description="Órdenes, facturación y seguimiento"
            href="/ecommerce"
            icon={<ReportMoneyIcon className="h-6 w-6" />}
            accentClass="bg-blue-50 text-blue-600"
          />
        </div>
      </div>
    </div>
  );
}
