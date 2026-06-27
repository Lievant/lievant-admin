import { notFound } from 'next/navigation';
import {
  ApiError,
  getClient,
  getClientFinancial,
  getCurrentUser,
  listClientDocuments,
  listClientDocumentTypes,
  listUsers,
  type ClientDetail,
} from '@/lib/api';
import { ClientDetailScreen } from './client-detail-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

interface ClientDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;

  let client: ClientDetail | null = null;
  let fetchError: string | null = null;

  try {
    client = await getClient(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    fetchError = err instanceof ApiError ? err.message : 'No se pudo conectar con la API.';
  }

  if (!client) {
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
  const canViewFinancial = roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN_FINANZAS');

  const [documents, financial, accountManagers, documentTypes] = await Promise.all([
    safe(listClientDocuments(id)),
    canViewFinancial ? safe(getClientFinancial(id)) : Promise.resolve(null),
    safe(listUsers()),
    safe(listClientDocumentTypes()),
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <ClientDetailScreen
        client={client}
        documents={documents ?? []}
        financial={financial}
        canViewFinancial={canViewFinancial}
        accountManagers={accountManagers ?? []}
        documentTypes={documentTypes ?? []}
      />
    </div>
  );
}
