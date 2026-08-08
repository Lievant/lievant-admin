import { notFound } from 'next/navigation';
import { getCurrentUser, getExpenseReport } from '@/lib/api';
import { ExpenseReportDetail } from '../../../herramientas/mis-reembolsos/expense-report-detail';

export default async function FinanzasReembolsoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [report, user] = await Promise.all([getExpenseReport(id), getCurrentUser()]);
    const canProcess =
      user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
      user.permissions.some(
        (p) => p.section === 'finanzas' && p.module === 'reembolsos' && p.action === 'process',
      );

    return (
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <ExpenseReportDetail
          report={report}
          viewer={{
            isOwner: report.requesterId === user.id,
            isAuthorizer: report.authorizerId === user.id,
            canProcess,
          }}
          backHref="/finanzas/reembolsos"
        />
      </div>
    );
  } catch {
    notFound();
  }
}
