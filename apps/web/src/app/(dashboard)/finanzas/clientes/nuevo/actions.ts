'use server';

import { ApiError, createClient, type CreateClientPayload } from '@/lib/api';

export interface CreateClientResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function createClientAction(payload: CreateClientPayload): Promise<CreateClientResult> {
  try {
    const client = await createClient(payload);
    return { success: true, id: client.id };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
