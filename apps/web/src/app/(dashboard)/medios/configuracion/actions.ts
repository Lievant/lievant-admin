'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, triggerMediaSync } from '@/lib/api';

export interface SyncActionResult {
  success: boolean;
  synced?: number;
  error?: string;
}

export async function triggerMediaSyncAction(): Promise<SyncActionResult> {
  try {
    const res = await triggerMediaSync();
    revalidatePath('/medios');
    revalidatePath('/medios/configuracion');
    return { success: true, synced: res.synced };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
