import { notFound } from 'next/navigation';
import {
  ApiError,
  getCurrentUser,
  getVendor,
  getVendorStatement,
  listActiveCatalogItems,
  listVendorDocuments,
  type VendorDetail,
} from '@/lib/api';
import { VendorDetailScreen } from './vendor-detail-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

interface VendorDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VendorDetailPage({ params }: VendorDetailPageProps) {
  const { id } = await params;

  let vendor: VendorDetail | null = null;
  let fetchError: string | null = null;

  try {
    vendor = await getVendor(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!vendor) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          {fetchError}
        </div>
      </div>
    );
  }

  const currentUser = await safe(getCurrentUser());
  const isSuperAdmin = currentUser?.roles.some((role) => role.name === 'SUPER_ADMIN') ?? false;
  const canViewBankDetails =
    isSuperAdmin ||
    (currentUser?.permissions.some((p) => p.section === 'finanzas' && p.module === 'proveedores.bancario' && p.action === 'read') ?? false);

  const [categories, documents, statement] = await Promise.all([
    safe(listActiveCatalogItems('vendor_categories')),
    safe(listVendorDocuments(id)),
    safe(getVendorStatement(id)),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <VendorDetailScreen
        vendor={vendor}
        categories={categories ?? []}
        canViewBankDetails={canViewBankDetails}
        documents={documents ?? []}
        statement={statement ?? { total_pending: 0, total_paid: 0, invoices: [] }}
      />
    </div>
  );
}
