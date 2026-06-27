import { notFound } from 'next/navigation';
import { ApiError, getCurrentUser, getTicket } from '@/lib/api';
import { TicketDetailScreen } from './ticket-detail-screen';

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: PageProps) {
  const { id } = await params;

  let fetchError: string | null = null;
  let ticket = null;

  try {
    ticket = await getTicket(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="rounded-lg border border-terracota/30 bg-terracota/5 px-4 py-3 text-sm text-terracota-dark">
          {fetchError}
        </div>
      </div>
    );
  }

  const currentUser = await safe(getCurrentUser());

  const isTd =
    currentUser?.roles.some((r) => r.name === 'SUPER_ADMIN' || r.name === 'TECNICO_TD') ||
    currentUser?.permissions.some((p) => p.module === 'tickets.gestion') ||
    false;

  const isOwner = currentUser?.id === ticket.requesterId;

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <TicketDetailScreen ticket={ticket} isTd={isTd} isOwner={isOwner} />
    </div>
  );
}
