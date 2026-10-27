'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createAccountPassword,
  revokeAccountPassword,
  updateAccountPassword,
  type AccountPasswordPayload,
} from '@/lib/api';

export interface PasswordActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

const PATH = '/herramientas/passwords';

function fail(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: fallback };
}

/** Advertencias de la contraseña guardada (reutilizada, débil). No impiden guardar. */
export interface SavedPasswordInfo {
  warnings: string[];
}

export async function createAccountPasswordAction(
  payload: AccountPasswordPayload,
): Promise<PasswordActionResult<SavedPasswordInfo>> {
  try {
    const saved = await createAccountPassword(payload);
    revalidatePath(PATH);
    return { success: true, data: { warnings: saved.passwordWarnings ?? [] } };
  } catch (err) {
    return fail(err, 'No se pudo registrar la cuenta.');
  }
}

export async function updateAccountPasswordAction(
  id: string,
  payload: Partial<AccountPasswordPayload>,
): Promise<PasswordActionResult<SavedPasswordInfo>> {
  try {
    const saved = await updateAccountPassword(id, payload);
    revalidatePath(PATH);
    return { success: true, data: { warnings: saved.passwordWarnings ?? [] } };
  } catch (err) {
    return fail(err, 'No se pudo guardar la cuenta.');
  }
}

export async function revokeAccountPasswordAction(id: string): Promise<PasswordActionResult> {
  try {
    await revokeAccountPassword(id);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'No se pudo revocar la cuenta.');
  }
}
