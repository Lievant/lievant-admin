import { notFound, redirect } from 'next/navigation';
import { getCardReport } from '@/lib/api';
import { CardExpenseForm } from '../../nuevo/card-expense-form';

export default async function EditarGastoTarjetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const report = await getCardReport(id);

    // Enviado en adelante es inmutable: al detalle en vez de a un formulario que
    // el backend va a rechazar.
    if (report.status !== 'draft') redirect(`/herramientas/mis-gastos-tarjeta/${id}`);

    return (
      <div className="mx-auto max-w-screen-xl px-6 py-8">
        <h1 className="mb-5 text-2xl font-bold text-navy">Editar reporte {report.reportNumber}</h1>
        <CardExpenseForm report={report} />
      </div>
    );
  } catch (err) {
    // redirect() lanza una señal interna de Next que no debe tragarse.
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    notFound();
  }
}
