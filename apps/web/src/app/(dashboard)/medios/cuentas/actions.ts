'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createMediaAccount,
  updateMediaAccount,
  type CreateMediaAccountPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createMediaAccountAction(
  payload: CreateMediaAccountPayload,
): Promise<ActionResult> {
  try {
    await createMediaAccount(payload);
    revalidatePath('/medios/cuentas');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}

export async function updateMediaAccountAction(
  id: string,
  payload: Partial<CreateMediaAccountPayload>,
): Promise<ActionResult> {
  try {
    await updateMediaAccount(id, payload);
    revalidatePath('/medios/cuentas');
    revalidatePath(`/medios/cuentas/${id}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
