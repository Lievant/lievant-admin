import { listActiveCatalogItems, listVendors, type ListVendorsParams, type VendorStatus } from '@/lib/api';
import { VendorsScreen } from './vendors-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function asString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

interface ProveedoresPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProveedoresPage({ searchParams }: ProveedoresPageProps) {
  const params = await searchParams;

  const status = asString(params.status) as VendorStatus | undefined;
  const categoryId = asString(params.category_id);
  const search = asString(params.search);

  const query: ListVendorsParams = {};
  if (status) query.status = status;
  if (categoryId) query.category_id = categoryId;
  if (search) query.search = search;

  const [vendors, categories] = await Promise.all([
    safe(listVendors(query)),
    safe(listActiveCatalogItems('vendor_categories')),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <VendorsScreen
        vendors={vendors ?? []}
        categories={categories ?? []}
        apiUnavailable={vendors === null}
        filters={{ status: status ?? '', category_id: categoryId ?? '', search: search ?? '' }}
      />
    </div>
  );
}
