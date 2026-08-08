import { notFound } from 'next/navigation';
import { getCardReport, getCurrentUser } from '@/lib/api';
import { CardReportDetail } from '../card-report-detail';

export default async function GastoTarjetaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [report, user] = await Promise.all([getCardReport(id), getCurrentUser()]);
    const canProcess =
      user.roles.some((r) => r.name === 'SUPER_ADMIN') ||
      user.permissions.some(
        (p) => p.section === 'finanzas' && p.module === 'gastos-tarjeta' && p.action === 'process',
      );

    return (
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <CardReportDetail
          report={report}
          viewer={{ isCreator: report.creatorId === user.id, canProcess }}
          backHref="/herramientas/mis-gastos-tarjeta"
        />
      </div>
    );
  } catch {
    notFound();
  }
}
