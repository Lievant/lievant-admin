'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, createTool, type CreateToolPayload } from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

export async function createToolAction(payload: CreateToolPayload): Promise<ActionResult> {
  try {
    await createTool(payload);
    revalidatePath('/transformacion/licenciamientos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
