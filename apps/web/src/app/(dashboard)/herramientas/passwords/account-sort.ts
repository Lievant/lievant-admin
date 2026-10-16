export type DisplayStatus = 'activa' | 'por_vencer' | 'vencida' | 'revocada';

/** Etiquetas visibles del estado: el orden por Estado es por este texto, no por la clave. */
export const STATUS_LABEL: Record<DisplayStatus, string> = {
  activa: 'Activa',
  por_vencer: 'Por vencer',
  vencida: 'Vencida',
  revocada: 'Revocada',
};

/**
 * Columnas ordenables. Contraseña y Acciones no figuran a propósito: la primera
 * es un valor enmascarado y sensible y la segunda no es un dato.
 */
export type AccountSortKey =
  | 'recordNumber'
  | 'application'
  | 'employee'
  | 'area'
  | 'username'
  | 'assignedDate'
  | 'expiryDate'
  | 'status';

/** Lo único que el orden lee de una cuenta (todo ya visible en la tabla). */
export interface SortableAccount {
  recordNumber: number;
  application: { name: string };
  employee: { fullName: string; area: string | null };
  username: string;
  assignedDate: string;
  expiryDate: string | null;
}

export interface AccountRow {
  account: SortableAccount;
  status: DisplayStatus;
}

/** AAAA-MM-DD a marca de tiempo, para ordenar por la fecha real y no por el texto mostrado. */
function dayValue(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

/**
 * Valor comparable de una fila por columna. Solo usa campos que ya son visibles
 * en la tabla; nunca toca la contraseña. Vacío = null (siempre al final).
 */
export function accountSortValue(row: AccountRow, key: AccountSortKey): string | number | null {
  const a = row.account;
  switch (key) {
    case 'recordNumber':
      return a.recordNumber;
    case 'application':
      return a.application.name;
    case 'employee':
      return a.employee.fullName;
    case 'area':
      return a.employee.area;
    case 'username':
      return a.username;
    case 'assignedDate':
      return dayValue(a.assignedDate);
    case 'expiryDate':
      return dayValue(a.expiryDate);
    case 'status':
      return STATUS_LABEL[row.status];
  }
}
