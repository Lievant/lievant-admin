'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  authorizeExpenseReport,
  createExpenseReport,
  deleteExpenseReport,
  processExpenseReport,
  submitExpenseReport,
  updateExpenseReport,
  type ExpenseReportPayload,
} from '@/lib/api';

export interface ExpenseActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

function toResult(err: unknown): ExpenseActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

function revalidateAll(id?: string): void {
  revalidatePath('/herramientas/mis-reembolsos');
  revalidatePath('/finanzas/reembolsos');
  if (id) {
    revalidatePath(`/herramientas/mis-reembolsos/${id}`);
    revalidatePath(`/finanzas/reembolsos/${id}`);
  }
}

export async function createExpenseReportAction(
  payload: ExpenseReportPayload,
): Promise<ExpenseActionResult> {
  try {
    const report = await createExpenseReport(payload);
    revalidateAll(report.id);
    return { success: true, id: report.id };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateExpenseReportAction(
  id: string,
  payload: ExpenseReportPayload,
): Promise<ExpenseActionResult> {
  try {
    await updateExpenseReport(id, payload);
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function submitExpenseReportAction(id: string): Promise<ExpenseActionResult> {
  try {
    await submitExpenseReport(id);
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteExpenseReportAction(id: string): Promise<ExpenseActionResult> {
  try {
    await deleteExpenseReport(id);
    revalidateAll(id);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function authorizeExpenseReportAction(
  id: string,
  action: 'authorized' | 'rejected',
  note?: string,
): Promise<ExpenseActionResult> {
  try {
    await authorizeExpenseReport(id, { action, ...(note ? { note } : {}) });
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function processExpenseReportAction(
  id: string,
  paymentDate: string,
  note?: string,
): Promise<ExpenseActionResult> {
  try {
    await processExpenseReport(id, { paymentDate, ...(note ? { note } : {}) });
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}
