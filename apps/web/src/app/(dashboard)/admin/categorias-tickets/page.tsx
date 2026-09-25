import {
  errorKindOf,
  listTicketCategories,
  listTicketSubcategories,
  type ErrorKind,
} from '@/lib/api';
import { TicketCategoriesScreen } from './ticket-categories-screen';

async function safe<T>(
  promise: Promise<T>,
): Promise<{ data: T | null; errorKind: ErrorKind | null }> {
  try {
    return { data: await promise, errorKind: null };
  } catch (err) {
    return { data: null, errorKind: errorKindOf(err) };
  }
}

export default async function CategoriasTicketsPage() {
  const [categoriesResult, subcategoriesResult] = await Promise.all([
    safe(listTicketCategories()),
    safe(listTicketSubcategories()),
  ]);

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <TicketCategoriesScreen
        categories={categoriesResult.data ?? []}
        subcategories={subcategoriesResult.data ?? []}
        errorKind={categoriesResult.errorKind}
      />
    </div>
  );
}
