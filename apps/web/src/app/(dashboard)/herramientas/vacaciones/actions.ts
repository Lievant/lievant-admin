'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, deleteVacationRequest } from '@/lib/api';

export interface DeleteVacationRequestActionResult {
  success: boolean;
  daysReturned?: number;
  error?: string;
}

export async function deleteVacationRequestAction(
  requestId: string,
): Promise<DeleteVacationRequestActionResult> {
  try {
    const res = await deleteVacationRequest(requestId);
    revalidatePath('/herramientas/vacaciones');
    // El widget del dashboard y el badge leen notificaciones que acaban de
    // ocultarse con la solicitud.
    revalidatePath('/dashboard');
    return { success: true, daysReturned: res.daysReturned };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
