'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, deleteClient } from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  try {
    await deleteClient(id);
    revalidatePath('/finanzas/clientes');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
