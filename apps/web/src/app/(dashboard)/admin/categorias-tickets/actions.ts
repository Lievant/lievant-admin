'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createTicketCategory,
  createTicketSubcategory,
  deactivateTicketCategory,
  deactivateTicketSubcategory,
  updateTicketCategory,
  updateTicketSubcategory,
  type UpsertCategoryPayload,
  type UpsertSubcategoryPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

const PATH = '/admin/categorias-tickets';

export async function createCategoryAction(payload: UpsertCategoryPayload): Promise<ActionResult> {
  try {
    await createTicketCategory(payload);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCategoryAction(
  slug: string,
  payload: UpsertCategoryPayload,
): Promise<ActionResult> {
  try {
    await updateTicketCategory(slug, payload);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateCategoryAction(slug: string): Promise<ActionResult> {
  try {
    await deactivateTicketCategory(slug);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createSubcategoryAction(
  slug: string,
  payload: UpsertSubcategoryPayload,
): Promise<ActionResult> {
  try {
    await createTicketSubcategory(slug, payload);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateSubcategoryAction(
  id: string,
  payload: UpsertSubcategoryPayload,
): Promise<ActionResult> {
  try {
    await updateTicketSubcategory(id, payload);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateSubcategoryAction(id: string): Promise<ActionResult> {
  try {
    await deactivateTicketSubcategory(id);
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
