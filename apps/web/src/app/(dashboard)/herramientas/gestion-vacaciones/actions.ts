'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, approveVacationRequest, rejectVacationRequest } from '@/lib/api';

export interface TeamVacationActionResult {
  success: boolean;
  error?: string;
}

/** Revalida la pantalla del jefe y el dashboard, que muestra el mismo pendiente. */
function revalidateTeamViews(): void {
  revalidatePath('/herramientas/gestion-vacaciones');
  revalidatePath('/dashboard');
}

export async function approveTeamVacationAction(
  requestId: string,
  note?: string,
): Promise<TeamVacationActionResult> {
  try {
    await approveVacationRequest(requestId, note?.trim() || undefined);
    revalidateTeamViews();
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}

export async function rejectTeamVacationAction(
  requestId: string,
  reason: string,
): Promise<TeamVacationActionResult> {
  const motivo = reason.trim();
  // El backend exige mínimo 3 caracteres; validarlo aquí evita el viaje y da
  // un mensaje en el idioma de la pantalla.
  if (motivo.length < 3) {
    return { success: false, error: 'Indica el motivo del rechazo (mínimo 3 caracteres).' };
  }

  try {
    await rejectVacationRequest(requestId, motivo);
    revalidateTeamViews();
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
