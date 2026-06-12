import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listCatalogItems } from '@/lib/api';
import { getCatalogConfig } from '../constants';
import { CatalogDetailScreen } from './catalog-detail-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

interface CatalogEntityPageProps {
  params: Promise<{ entity: string }>;
}

export default async function CatalogEntityPage({ params }: CatalogEntityPageProps) {
  const { entity } = await params;
  const config = getCatalogConfig(entity);

  if (!config) {
    notFound();
  }

  const items = await safe(listCatalogItems(config.entity));
  const apiUnavailable = items === null;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <nav className="text-sm text-slate-500">
        <Link href="/admin" className="hover:text-terracota">
          Administración
        </Link>
        {' / '}
        <Link href="/admin/catalogos" className="hover:text-terracota">
          Catálogos
        </Link>
        {' / '}
        <span className="text-navy">{config.label}</span>
      </nav>

      {apiUnavailable && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión como administrador para ver datos en vivo.
        </div>
      )}

      <CatalogDetailScreen config={config} items={items ?? []} />
    </div>
  );
}
