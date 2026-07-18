'use server';

import { revalidatePath } from 'next/cache';
import { acknowledgeMediaAlert, ApiError } from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function acknowledgeMediaAlertAction(id: string): Promise<ActionResult> {
  try {
    await acknowledgeMediaAlert(id);
    revalidatePath('/medios/alertas');
    revalidatePath('/medios');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
