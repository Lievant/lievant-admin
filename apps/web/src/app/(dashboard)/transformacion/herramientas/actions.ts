'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  approveToolAssignment,
  assignTool,
  createToolRecord,
  deleteToolRecord,
  revokeToolAssignment,
  updateToolRecord,
  type AssignToolPayload,
  type CreateToolRecordPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

const LIST_PATH = '/transformacion/herramientas';

export async function createToolRecordAction(
  payload: CreateToolRecordPayload,
): Promise<ActionResult> {
  try {
    await createToolRecord(payload);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateToolRecordAction(
  id: string,
  payload: Partial<CreateToolRecordPayload>,
): Promise<ActionResult> {
  try {
    await updateToolRecord(id, payload);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteToolRecordAction(id: string): Promise<ActionResult> {
  try {
    await deleteToolRecord(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function assignToolAction(
  toolId: string,
  payload: AssignToolPayload,
): Promise<ActionResult> {
  try {
    await assignTool(toolId, payload);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${toolId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function approveToolAssignmentAction(
  toolId: string,
  assignmentId: string,
): Promise<ActionResult> {
  try {
    await approveToolAssignment(toolId, assignmentId);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${toolId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function revokeToolAssignmentAction(
  toolId: string,
  assignmentId: string,
  notes?: string,
): Promise<ActionResult> {
  try {
    await revokeToolAssignment(toolId, assignmentId, notes);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${toolId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
