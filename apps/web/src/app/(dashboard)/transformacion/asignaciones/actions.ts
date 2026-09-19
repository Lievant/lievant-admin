'use server';

import { revalidatePath } from 'next/cache';
import {
  addAssigner,
  ApiError,
  createAssignment,
  removeAssigner,
  revokeAssignment,
  updateAssignmentLastUsed,
  type CreateAssignerPayload,
  type CreateAssignmentPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

const LIST_PATH = '/transformacion/asignaciones';
// Asignar y revocar mueven active_assignments_count, que el catálogo muestra.
const CATALOG_PATH = '/transformacion/herramientas-catalogo';

function revalidateBoth() {
  revalidatePath(LIST_PATH);
  revalidatePath(CATALOG_PATH);
}

export async function createAssignmentAction(
  payload: CreateAssignmentPayload,
): Promise<ActionResult> {
  try {
    await createAssignment(payload);
    revalidateBoth();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function revokeAssignmentAction(id: string, reason?: string): Promise<ActionResult> {
  try {
    await revokeAssignment(id, reason);
    revalidateBoth();
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateLastUsedAction(id: string, date: string): Promise<ActionResult> {
  try {
    await updateAssignmentLastUsed(id, date);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addAssignerAction(payload: CreateAssignerPayload): Promise<ActionResult> {
  try {
    await addAssigner(payload);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeAssignerAction(id: string): Promise<ActionResult> {
  try {
    await removeAssigner(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
