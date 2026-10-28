import { getCurrentUser } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { OkrsReportScreen } from './okrs-report-screen';

export const dynamic = 'force-dynamic';

/** Reporte de OKRs: solo con rrhh.okrs.read (el API lo exige también en cada consulta). */
export default async function OkrsReportPage() {
  const user = await getCurrentUser().catch(() => null);
  const allowed = user?.permissions.some((p) => p.section === 'rrhh' && p.module === 'okrs' && p.action === 'read');
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
      {allowed ? <OkrsReportScreen /> : <NoPermissions />}
    </div>
  );
}
