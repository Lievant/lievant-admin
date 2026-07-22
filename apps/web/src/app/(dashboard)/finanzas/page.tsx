import { ModuleCard, StatCard } from '@/components/dashboard-cards';
import { BuildingIcon, ListIcon, TableIcon, TruckIcon } from '@/components/icons';
import { getMissingDocumentsReport, getProjectStats, listClients, listVendors } from '@/lib/api';

export default async function FinanzasPage() {
  const [clientsResult, missingDocsResult, vendorsResult, projectStatsResult] = await Promise.allSettled([
    listClients({ status: 'active' }),
    getMissingDocumentsReport(),
    listVendors({ status: 'activo' }),
    getProjectStats(),
  ]);

  const activeClients =
    clientsResult.status === 'fulfilled' ? clientsResult.value.total : null;
  const missingDocs =
    missingDocsResult.status === 'fulfilled' ? missingDocsResult.value.length : null;
  const activeVendors =
    vendorsResult.status === 'fulfilled' ? vendorsResult.value.length : null;
  const activeProjects =
    projectStatsResult.status === 'fulfilled' ? projectStatsResult.value.active : null;

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-terracota">Finanzas</p>
        <h1 className="mt-1 text-3xl font-bold text-navy">Resumen ejecutivo</h1>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Proyectos activos"
          value={activeProjects ?? '—'}
          href="/finanzas/proyectos?status=active"
          description="En cartera actual"
        />
        <StatCard
          label="Clientes activos"
          value={activeClients ?? '—'}
          href="/finanzas/clientes?status=active"
          description="Total en cartera"
        />
        <StatCard
          label="Sin documentos completos"
          value={missingDocs ?? '—'}
          href="/finanzas/reportes/documentos-faltantes"
          description="Clientes con expediente incompleto"
        />
        <StatCard
          label="Proveedores activos"
          value={activeVendors ?? '—'}
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
            title="Proyectos"
            description="Cartera de proyectos, equipo y facturación"
            href="/finanzas/proyectos"
            icon={<ListIcon className="h-6 w-6" />}
            accentClass="bg-purple-50 text-purple-600"
          />
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
            title="Reportes"
            description="Documentos faltantes y análisis de cartera"
            href="/finanzas/reportes"
            icon={<TableIcon className="h-6 w-6" />}
            accentClass="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>
    </div>
  );
}
