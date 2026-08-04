import { getCurrentUser, getHelpdeskCategories } from '@/lib/api';
import { NewTicketForm } from './new-ticket-form';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

export default async function NuevoTicketPage() {
  const [categories, currentUser] = await Promise.all([
    safe(getHelpdeskCategories()),
    safe(getCurrentUser()),
  ]);

  const isTd =
    currentUser?.roles.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'TECNICO_TD') ||
    currentUser?.permissions.some((p) => p.module === 'tickets.gestion') ||
    false;

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-black">Soporte TI</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Abrir nuevo ticket</h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe el problema y nuestro equipo se pondrá en contacto contigo.
        </p>
      </header>
      <NewTicketForm categories={categories ?? []} isTd={isTd} />
    </div>
  );
}
