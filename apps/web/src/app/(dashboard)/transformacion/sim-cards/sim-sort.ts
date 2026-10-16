/** Lo único que el orden lee de una línea (todo visible en la tabla; nunca el ICCID). */
export interface SortableSim {
  simCode: string;
  phoneNumber: string;
  plan: { name: string };
  provider: { name: string } | null;
  employee: { fullName: string } | null;
  monthlyCost: number;
  currency: string;
  termMonths: number | null;
  contractEndDate: string | null;
  assignedDate: string | null;
  status: string;
}

/** Columnas ordenables. Acciones no figura: no es un dato. */
export type SimSortKey =
  | 'simCode'
  | 'provider'
  | 'phoneNumber'
  | 'plan'
  | 'planValue'
  | 'termMonths'
  | 'contractEndDate'
  | 'employee'
  | 'assignedDate'
  | 'status';

const STATUS_TEXT: Record<string, string> = {
  activa: 'Activa',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

/** AAAA-MM-DD a marca de tiempo: orden por la fecha real y no por el texto mostrado. */
function dayValue(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

/**
 * Valor comparable por columna; null = vacío (siempre al final, en ambos sentidos).
 *
 * El valor del plan ordena primero por moneda y luego por monto, con el monto
 * rellenado a ancho fijo para que la comparación de texto sea numérica. Nunca se
 * comparan montos de monedas distintas entre sí.
 */
export function simSortValue(sim: SortableSim, key: SimSortKey): string | number | null {
  switch (key) {
    case 'simCode':
      return sim.simCode;
    case 'provider':
      return sim.provider?.name ?? null;
    case 'phoneNumber':
      return sim.phoneNumber;
    case 'plan':
      return sim.plan.name;
    case 'planValue':
      return `${sim.currency}|${sim.monthlyCost.toFixed(2).padStart(16, '0')}`;
    case 'termMonths':
      return sim.termMonths;
    case 'contractEndDate':
      return dayValue(sim.contractEndDate);
    case 'employee':
      return sim.employee?.fullName ?? null;
    case 'assignedDate':
      return dayValue(sim.assignedDate);
    case 'status':
      return STATUS_TEXT[sim.status] ?? sim.status;
  }
}
