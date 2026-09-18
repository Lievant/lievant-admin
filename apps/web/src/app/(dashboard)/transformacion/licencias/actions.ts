'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createLicenseRecord,
  revokeLicenseRecord,
  updateLicenseRecord,
  type CreateLicensePayload,
  type LicenseStatus,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

const LIST_PATH = '/transformacion/licencias';
// El alta y la revocación mueven los contadores del catálogo, así que esa
// pantalla también queda revalidada.
const CATALOG_PATH = '/transformacion/herramientas-catalogo';

export async function createLicenseAction(payload: CreateLicensePayload): Promise<ActionResult> {
  try {
    await createLicenseRecord(payload);
    revalidatePath(LIST_PATH);
    revalidatePath(CATALOG_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateLicenseAction(
  id: string,
  payload: Partial<CreateLicensePayload> & { status?: LicenseStatus },
): Promise<ActionResult> {
  try {
    await updateLicenseRecord(id, payload);
    revalidatePath(LIST_PATH);
    revalidatePath(CATALOG_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function revokeLicenseAction(id: string, note?: string): Promise<ActionResult> {
  try {
    await revokeLicenseRecord(id, note);
    revalidatePath(LIST_PATH);
    revalidatePath(CATALOG_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
