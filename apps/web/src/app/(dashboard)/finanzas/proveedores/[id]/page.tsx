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
        <div className="rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          {fetchError}
        </div>
      </div>
    );
  }

  const currentUser = await safe(getCurrentUser());
  const roleNames = currentUser?.roles.map((role) => role.name) ?? [];
  const canViewBankDetails = roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN_FINANZAS');

  const [categories, documents, statement] = await Promise.all([
    safe(listActiveCatalogItems('vendor_categories')),
    safe(listVendorDocuments(id)),
    safe(getVendorStatement(id)),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
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
