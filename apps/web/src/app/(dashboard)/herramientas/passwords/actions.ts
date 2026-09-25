'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createAccountPassword,
  createPasswordApplication,
  revokeAccountPassword,
  updateAccountPassword,
  type AccountPasswordPayload,
  type PasswordApplication,
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

export async function createAccountPasswordAction(
  payload: AccountPasswordPayload,
): Promise<PasswordActionResult> {
  try {
    await createAccountPassword(payload);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'No se pudo registrar la cuenta.');
  }
}

export async function updateAccountPasswordAction(
  id: string,
  payload: Partial<AccountPasswordPayload>,
): Promise<PasswordActionResult> {
  try {
    await updateAccountPassword(id, payload);
    revalidatePath(PATH);
    return { success: true };
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

/** Alta inline desde el modal: devuelve la aplicación para seleccionarla. */
export async function createPasswordApplicationAction(
  name: string,
  category?: string,
): Promise<PasswordActionResult<PasswordApplication>> {
  const nombre = name.trim();
  if (nombre.length < 2) return { success: false, error: 'Escribe el nombre de la aplicación.' };
  try {
    const app = await createPasswordApplication({
      name: nombre,
      ...(category?.trim() ? { category: category.trim() } : {}),
    });
    revalidatePath(PATH);
    return { success: true, data: app };
  } catch (err) {
    return fail(err, 'No se pudo crear la aplicación.');
  }
}
