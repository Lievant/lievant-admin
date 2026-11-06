import { apiFetch } from '@/lib/api';
import { selectionFromParams, selectionToQuery, viewFromParams } from './org-filters';
import { OrganigramaScreen, type OrgChartData } from './organigrama-screen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrganigramaPage({ searchParams }: PageProps) {
  // Los filtros viven en la URL (como la pantalla de Empleados): se pueden compartir y sobreviven a recargar.
  const params = await searchParams;
  const selection = selectionFromParams(params);
  const query = selectionToQuery(selection);
  let data: OrgChartData | null = null;
  let failed = false;
  try {
    data = await apiFetch<OrgChartData>(`/employees/org-chart${query ? `?${query}` : ''}`);
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <OrganigramaScreen initial={data} initialError={failed} initialSelection={selection} initialView={viewFromParams(params)} />
    </div>
  );
}
