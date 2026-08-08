import { CardExpenseForm } from './card-expense-form';

export default function NuevoGastoTarjetaPage() {
  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <h1 className="mb-5 text-2xl font-bold text-navy">Nuevo reporte de gastos de tarjeta</h1>
      <CardExpenseForm report={null} />
    </div>
  );
}
