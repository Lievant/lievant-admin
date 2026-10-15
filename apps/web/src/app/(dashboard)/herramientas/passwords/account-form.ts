import { isValidEmail } from './utils';

/** Lo mínimo de una persona visible que necesita el formulario. */
export interface OwnerCandidate {
  id: string;
  isMe: boolean;
}

export interface AccountFormInput {
  isEdit: boolean;
  applicationId: string;
  /** Titular que tiene el estado del formulario (puede estar vacío o desfasado). */
  employeeId: string;
  /** La propia persona y sus subordinados directos activos. */
  people: OwnerCandidate[];
  username: string;
  password: string;
  assignedDate: string;
  expiryDate: string;
  notes: string;
}

/**
 * Titular efectivo de la cuenta: el del formulario si es una persona visible; si
 * no (vacío o desfasado), la propia persona. El selector también muestra a la
 * propia persona cuando su valor no coincide con nadie, así que lo que se ve y
 * lo que se envía no pueden quedar distintos.
 */
export function resolveOwnerId(people: OwnerCandidate[], employeeId: string): string {
  if (people.some((p) => p.id === employeeId)) return employeeId;
  return people.find((p) => p.isMe)?.id ?? '';
}

/** Primer problema del formulario, o null si se puede guardar. */
export function validateAccountForm(input: AccountFormInput): string | null {
  if (!input.applicationId) return 'Selecciona la aplicación.';
  if (!input.isEdit && !resolveOwnerId(input.people, input.employeeId)) {
    return 'No se pudo determinar de quién es la cuenta.';
  }
  if (!isValidEmail(input.username)) return 'El usuario debe ser un correo válido.';
  if (!input.isEdit && !input.password) return 'Escribe o genera la contraseña.';
  if (input.expiryDate && input.expiryDate < input.assignedDate) {
    return 'El vencimiento no puede ser anterior a la fecha de asignación.';
  }
  return null;
}

/** Cuerpo que se envía al API. El titular solo viaja al crear; al editar no se cambia. */
export function buildAccountPayload(input: AccountFormInput) {
  return {
    applicationId: input.applicationId,
    ...(input.isEdit ? {} : { employeeId: resolveOwnerId(input.people, input.employeeId) }),
    username: input.username.trim(),
    assignedDate: input.assignedDate,
    expiryDate: input.expiryDate || null,
    notes: input.notes.trim() || null,
    ...(input.password ? { password: input.password } : {}),
  };
}
