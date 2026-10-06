import { Hint } from '@/app/(dashboard)/herramientas/mis-reembolsos/expense-shared';

/** Compartido por Mis Gastos de Tarjeta y Mis Reembolsos. Texto de la celda "Información" por tipo de gasto (nombres del catálogo). Única fuente para todas las vistas. */
const EXPENSE_TYPE_INFO: Record<string, string> = {
  'Viáticos cliente': 'Este costo lo asume directamente el cliente',
  'Costo operativo': 'Este gasto lo asume el área operativa',
  'Costo de venta / temas comerciales': 'Área de la división',
  'Costo de Marketing': 'Costos relacionados al tema de marketing',
};

/** Tipo fuera del mapa: texto vacío. */
export function expenseTypeInfo(typeName: string | null | undefined): string {
  return (typeName && EXPENSE_TYPE_INFO[typeName]) || '';
}

/** Celda de solo lectura: se calcula del tipo de la fila, no se guarda. */
export function ExpenseTypeInfoCell({ typeName }: { typeName: string | null | undefined }) {
  return (
    <span className="block min-w-[220px] whitespace-normal text-xs text-slate-500">
      {expenseTypeInfo(typeName)}
    </span>
  );
}

/** Encabezado "Información" con la "i" explicativa general (igual que Factura). */
export function ExpenseTypeInfoHeader() {
  return (
    <>
      Información
      <Hint text="Costo de operación: lo asume el área operativa. Área de la división: venta/comercial. Marketing de la División: temas de marketing. Viáticos cliente: lo asume directamente el cliente. Con esta asignación el gasto se envía al departamento que le corresponda." />
    </>
  );
}
