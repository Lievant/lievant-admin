import Link from 'next/link';
import { notFound } from 'next/navigation';
import { errorKindOf, listCatalogItems, type ErrorKind } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { getCatalogConfig } from '../constants';
import { CatalogDetailScreen } from './catalog-detail-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
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

  const { data: items, errorKind } = await safe(listCatalogItems(config.entity));

  if (errorKind === 'forbidden') {
    return (
      <div className="mx-auto max-w-5xl px-8 py-10">
        <NoPermissions />
      </div>
    );
  }

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

      {errorKind === 'unavailable' && (
        <div className="mt-6 rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          No se pudo conectar con la API. Inicia sesión como administrador para ver datos en vivo.
        </div>
      )}

      <CatalogDetailScreen config={config} items={items ?? []} />
    </div>
  );
}
