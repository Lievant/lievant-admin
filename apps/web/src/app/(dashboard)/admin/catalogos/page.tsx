import Link from 'next/link';
import { listCatalogItems } from '@/lib/api';
import { CATALOG_CONFIGS } from './constants';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function CatalogosPage() {
  const results = await Promise.all(CATALOG_CONFIGS.map((config) => safe(listCatalogItems(config.entity))));

  const apiUnavailable = results.every((result) => result === null);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold text-navy">Catálogos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Datos base que alimentan los formularios de Empleados y Clientes.
        </p>
      </header>

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión como administrador para ver datos en vivo.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG_CONFIGS.map((config, index) => {
          const items = results[index];
          const activeCount = items?.filter((item) => item.isActive).length ?? null;
          return (
            <div key={config.entity} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-terracota-bg text-terracota">
                  {typeof config.icon === 'string' ? (
                    <i className={`ti ${config.icon} text-xl leading-none`} />
                  ) : (
                    <config.icon className="h-5 w-5" />
                  )}
                </div>
              </div>
              <h2 className="mt-4 text-base font-semibold text-navy">{config.label}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {activeCount === null ? '—' : `${activeCount} activos`}
              </p>
              <Link
                href={`/admin/catalogos/${config.entity}`}
                className="mt-4 inline-flex items-center text-sm font-semibold text-terracota hover:text-terracota-dark"
              >
                Gestionar →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
