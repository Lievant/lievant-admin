'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createMediaCredential,
  deactivateMediaCredential,
  triggerMediaSync,
  updateMediaCredential,
  type CreateMediaCredentialPayload,
  type UpdateMediaCredentialPayload,
} from '@/lib/api';

export interface SyncActionResult {
  success: boolean;
  synced?: number;
  error?: string;
}

export interface ActionResult {
  success: boolean;
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

export async function createMediaCredentialAction(
  payload: CreateMediaCredentialPayload,
): Promise<ActionResult> {
  try {
    await createMediaCredential(payload);
    revalidatePath('/medios/configuracion');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}

export async function updateMediaCredentialAction(
  id: string,
  payload: UpdateMediaCredentialPayload,
): Promise<ActionResult> {
  try {
    await updateMediaCredential(id, payload);
    revalidatePath('/medios/configuracion');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}

export async function deactivateMediaCredentialAction(id: string): Promise<ActionResult> {
  try {
    await deactivateMediaCredential(id);
    revalidatePath('/medios/configuracion');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
