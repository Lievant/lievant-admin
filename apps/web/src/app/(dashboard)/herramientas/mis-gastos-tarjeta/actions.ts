'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  createCardReport,
  createCreditCard,
  deleteCardReport,
  deleteCreditCard,
  processCardReport,
  submitCardReport,
  toggleCreditCard,
  updateCardReport,
  updateCreditCard,
  type CardReportPayload,
  type CreditCardPayload,
} from '@/lib/api';

export interface CardActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

function toResult(err: unknown): CardActionResult {
  if (err instanceof ApiError) return { success: false, error: err.message };
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

function revalidateAll(id?: string): void {
  revalidatePath('/herramientas/mis-gastos-tarjeta');
  revalidatePath('/finanzas/tarjetas');
  if (id) {
    revalidatePath(`/herramientas/mis-gastos-tarjeta/${id}`);
    revalidatePath(`/finanzas/tarjetas/reportes/${id}`);
  }
}

// ── Reportes ────────────────────────────────────────────────────────────────

export async function createCardReportAction(
  payload: CardReportPayload,
): Promise<CardActionResult> {
  try {
    const report = await createCardReport(payload);
    revalidateAll(report.id);
    return { success: true, id: report.id };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCardReportAction(
  id: string,
  payload: CardReportPayload,
): Promise<CardActionResult> {
  try {
    await updateCardReport(id, payload);
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function submitCardReportAction(id: string): Promise<CardActionResult> {
  try {
    await submitCardReport(id);
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteCardReportAction(id: string): Promise<CardActionResult> {
  try {
    await deleteCardReport(id);
    revalidateAll(id);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function processCardReportAction(
  id: string,
  paymentDate: string,
  note?: string,
): Promise<CardActionResult> {
  try {
    await processCardReport(id, { paymentDate, ...(note ? { note } : {}) });
    revalidateAll(id);
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

// ── Maestro de tarjetas ─────────────────────────────────────────────────────

export async function createCreditCardAction(
  payload: CreditCardPayload,
): Promise<CardActionResult> {
  try {
    const card = await createCreditCard(payload);
    revalidatePath('/finanzas/tarjetas');
    return { success: true, id: card.id };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCreditCardAction(
  id: string,
  payload: Partial<CreditCardPayload>,
): Promise<CardActionResult> {
  try {
    await updateCreditCard(id, payload);
    revalidatePath('/finanzas/tarjetas');
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function toggleCreditCardAction(id: string): Promise<CardActionResult> {
  try {
    await toggleCreditCard(id);
    revalidatePath('/finanzas/tarjetas');
    return { success: true, id };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteCreditCardAction(id: string): Promise<CardActionResult> {
  try {
    await deleteCreditCard(id);
    revalidatePath('/finanzas/tarjetas');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
