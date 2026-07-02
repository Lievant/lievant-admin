'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, deleteTicket } from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function deleteTicketAction(id: string): Promise<ActionResult> {
  try {
    await deleteTicket(id);
    revalidatePath('/transformacion/tickets');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
