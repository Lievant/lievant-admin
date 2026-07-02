'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, deleteEmployee } from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  try {
    await deleteEmployee(id);
    revalidatePath('/rrhh/empleados');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
