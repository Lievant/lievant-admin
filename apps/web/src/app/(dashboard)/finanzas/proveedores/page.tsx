import {
  errorKindOf,
  listActiveCatalogItems,
  listVendors,
  type ErrorKind,
  type ListVendorsParams,
  type VendorDocStatus,
  type VendorStatus,
} from '@/lib/api';
import { VendorsScreen } from './vendors-screen';

async function safe<T>(promise: Promise<T>): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
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
  const docStatus = asString(params.docStatus) as VendorDocStatus | undefined;

  const query: ListVendorsParams = {};
  if (status) query.status = status;
  if (categoryId) query.category_id = categoryId;
  if (search) query.search = search;
  if (docStatus) query.docStatus = docStatus;

  const [vendorsResult, categoriesResult] = await Promise.all([
    safe(listVendors(query)),
    safe(listActiveCatalogItems('vendor_categories')),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <VendorsScreen
        vendors={vendorsResult.data ?? []}
        categories={categoriesResult.data ?? []}
        errorKind={vendorsResult.errorKind}
        filters={{
          status: status ?? '',
          category_id: categoryId ?? '',
          search: search ?? '',
          docStatus: docStatus ?? '',
        }}
      />
    </div>
  );
}
