import { apiFetch } from '@/lib/api';
import { OrganigramaScreen, type OrgChartData } from './organigrama-screen';

export default async function OrganigramaPage() {
  let data: OrgChartData | null = null;
  let failed = false;
  try {
    data = await apiFetch<OrgChartData>('/employees/org-chart');
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <OrganigramaScreen initial={data} initialError={failed} />
    </div>
  );
}
