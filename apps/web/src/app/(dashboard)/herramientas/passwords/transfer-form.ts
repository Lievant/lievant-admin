/** Largo de passwords.account_transfers.reason; el DTO del API usa el mismo tope. */
export const TRANSFER_REASON_MAX = 300;

/** Aviso fijo del modal: la transferencia no cambia ni oculta la contraseña. */
export const TRANSFER_WARNING =
  'La contraseña no cambia. Quien la tenía todavía la conoce. Cámbiala en la plataforma después de transferir.';

/** Texto del botón de confirmación: dice a quién se transfiere. */
export function transferConfirmLabel(targetName: string | null): string {
  return targetName ? `Transferir a ${targetName}` : 'Elige a quién transferir';
}

/** Primer problema del formulario, o null si se puede enviar. */
export function validateTransferForm(input: { ownerId: string; toEmployeeId: string; reason: string }): string | null {
  if (!input.toEmployeeId) return 'Elige a quién se transfiere la cuenta.';
  if (input.toEmployeeId === input.ownerId) return 'La cuenta ya es de esa persona.';
  if (input.reason.trim().length > TRANSFER_REASON_MAX) {
    return `El motivo no puede pasar de ${TRANSFER_REASON_MAX} caracteres.`;
  }
  return null;
}

/** Cuerpo para POST /passwords/:id/transfer. Un motivo vacío no viaja. */
export function buildTransferPayload(input: { toEmployeeId: string; reason: string }) {
  const reason = input.reason.trim();
  return { toEmployeeId: input.toEmployeeId, ...(reason ? { reason } : {}) };
}
