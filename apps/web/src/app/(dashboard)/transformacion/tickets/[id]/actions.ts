'use server';

import {
  ApiError,
  escalateTicket,
  updateTicket,
  updateTicketStatus,
  type EscalateTicketPayload,
  type TicketPriority,
  type TicketStatus,
  type UpdateTicketPayload,
} from '@/lib/api';

export interface TicketActionResult {
  success: boolean;
  error?: string;
}

export async function updateStatusAction(
  id: string,
  status: TicketStatus,
  notes?: string,
): Promise<TicketActionResult> {
  try {
    await updateTicketStatus(id, { status, notes });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof ApiError ? err.message : 'Error inesperado.' };
  }
}

export async function updateTicketAction(
  id: string,
  payload: UpdateTicketPayload,
): Promise<TicketActionResult> {
  try {
    await updateTicket(id, payload);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof ApiError ? err.message : 'Error inesperado.' };
  }
}

export async function escalateAction(
  id: string,
  payload: EscalateTicketPayload,
): Promise<TicketActionResult> {
  try {
    await escalateTicket(id, payload);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof ApiError ? err.message : 'Error inesperado.' };
  }
}

export async function updatePriorityAction(
  id: string,
  priority: TicketPriority,
): Promise<TicketActionResult> {
  return updateTicketAction(id, { priority });
}
