'use server';

import { ApiError, createTicket, type CreateTicketPayload } from '@/lib/api';

export interface CreateTicketResult {
  success: boolean;
  displayId?: string;
  id?: string;
  error?: string;
}

export async function createTicketAction(payload: CreateTicketPayload): Promise<CreateTicketResult> {
  try {
    const ticket = await createTicket(payload);
    return { success: true, id: ticket.id, displayId: ticket.displayId };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
