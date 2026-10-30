'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createCatalogItem,
  deactivateCatalogItem,
  removeCompetency,
  updateCatalogItem,
  type CatalogEntity,
  type CreateCatalogItemPayload,
  type UpdateCatalogItemPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

export async function createCatalogItemAction(
  entity: CatalogEntity,
  payload: CreateCatalogItemPayload,
): Promise<ActionResult> {
  try {
    await createCatalogItem(entity, payload);
    revalidatePath(`/admin/catalogos/${entity}`);
    revalidatePath('/admin/catalogos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCatalogItemAction(
  entity: CatalogEntity,
  id: string,
  payload: UpdateCatalogItemPayload,
): Promise<ActionResult> {
  try {
    await updateCatalogItem(entity, id, payload);
    revalidatePath(`/admin/catalogos/${entity}`);
    revalidatePath('/admin/catalogos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeCompetencyAction(id: string): Promise<ActionResult> {
  try {
    await removeCompetency(id);
    revalidatePath('/admin/catalogos/competencies');
    revalidatePath('/admin/catalogos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

/** La importación terminó (el archivo se envió por la ruta proxy): refresca la tabla y la tarjeta del catálogo. */
export async function refreshCompetenciesAction(): Promise<void> {
  revalidatePath('/admin/catalogos/competencies');
  revalidatePath('/admin/catalogos');
}

export async function deactivateCatalogItemAction(entity: CatalogEntity, id: string): Promise<ActionResult> {
  try {
    await deactivateCatalogItem(entity, id);
    revalidatePath(`/admin/catalogos/${entity}`);
    revalidatePath('/admin/catalogos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
