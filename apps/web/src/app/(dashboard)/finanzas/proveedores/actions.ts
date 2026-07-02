'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, deleteVendor } from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function deleteVendorAction(id: string): Promise<ActionResult> {
  try {
    await deleteVendor(id);
    revalidatePath('/finanzas/proveedores');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
