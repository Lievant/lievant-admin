import { getCurrentUser } from '@/lib/api';
import { ExpenseReportForm } from '../expense-report-form';

export default async function NuevoReembolsoPage() {
  let requesterName = 'Yo';
  try {
    const user = await getCurrentUser();
    requesterName = user.name || user.email;
  } catch {
    /* el nombre es informativo; el backend toma el solicitante del token */
  }

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <h1 className="mb-5 text-2xl font-bold text-navy">Nuevo reporte de reembolso</h1>
      <ExpenseReportForm requesterName={requesterName} report={null} />
    </div>
  );
}
