import { getHelpdeskCategories } from '@/lib/api';
import { NewSupportTicketForm } from './new-support-ticket-form';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export default async function NuevoTicketPage() {
  const categories = await safe(getHelpdeskCategories());

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-black">Soporte TI</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Nuevo ticket de soporte</h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe tu problema y lo atenderemos lo antes posible.
        </p>
      </header>
      <NewSupportTicketForm categories={categories ?? []} />
    </div>
  );
}
