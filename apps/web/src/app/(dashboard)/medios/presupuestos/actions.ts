'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  updateMediaBudget,
  upsertMediaBudget,
  type UpsertMediaBudgetPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function upsertMediaBudgetAction(
  payload: UpsertMediaBudgetPayload,
): Promise<ActionResult> {
  try {
    await upsertMediaBudget(payload);
    revalidatePath('/medios/presupuestos');
    revalidatePath('/medios');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}

export async function updateMediaBudgetAction(
  id: string,
  payload: { amount?: number; currency?: string; notes?: string },
): Promise<ActionResult> {
  try {
    await updateMediaBudget(id, payload);
    revalidatePath('/medios/presupuestos');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
