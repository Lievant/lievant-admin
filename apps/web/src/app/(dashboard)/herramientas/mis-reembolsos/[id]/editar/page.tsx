import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, getExpenseReport } from '@/lib/api';
import { ExpenseReportForm } from '../../expense-report-form';

export default async function EditarReembolsoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [report, user] = await Promise.all([getExpenseReport(id), getCurrentUser()]);

    // Enviado en adelante es inmutable: se manda al detalle en vez de mostrar un
    // formulario que el backend va a rechazar.
    if (report.status !== 'draft') redirect(`/herramientas/mis-reembolsos/${id}`);

    return (
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <h1 className="mb-5 text-2xl font-bold text-navy">
          Editar reporte {report.reportNumber}
        </h1>
        <ExpenseReportForm requesterName={user.name || user.email} report={report} />
      </div>
    );
  } catch (err) {
    // redirect() lanza una señal interna de Next que no debe tragarse.
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    notFound();
  }
}
