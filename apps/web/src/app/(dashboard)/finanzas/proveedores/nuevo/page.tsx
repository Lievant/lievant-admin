import { listActiveCatalogItems } from '@/lib/api';
import { NewVendorForm } from './new-vendor-form';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function NewVendorPage() {
  const categories = await safe(listActiveCatalogItems('vendor_categories'));

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <NewVendorForm categories={categories ?? []} />
    </div>
  );
}
