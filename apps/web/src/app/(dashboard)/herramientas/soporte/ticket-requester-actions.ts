/**
 * Qué puede hacer el solicitante con su ticket. Es la misma regla que valida el
 * API (helpdesk.service: confirmResolution y assertRequesterTransition).
 */
export const REQUESTER_REOPEN_DAYS = 7;

export function requesterActions(
  t: { status: string; closedAt: string | null; collaboratorConfirmation: string | null },
  now: number = Date.now(),
): { canConfirm: boolean; canReportRecurrence: boolean } {
  const closedDaysAgo = t.closedAt ? (now - new Date(t.closedAt).getTime()) / 86_400_000 : null;
  return {
    canConfirm: t.status === 'resuelto' && t.collaboratorConfirmation !== 'confirmado',
    canReportRecurrence: t.status === 'cerrado' && closedDaysAgo !== null && closedDaysAgo <= REQUESTER_REOPEN_DAYS,
  };
}
