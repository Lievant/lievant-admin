'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  addVendorProduct,
  createInvoice,
  createPurchaseOrder,
  getPurchaseOrder,
  removeVendorDocument,
  updatePOStatus,
  updateVendor,
  type CreateInvoicePayload,
  type CreateProductPayload,
  type CreatePurchaseOrderPayload,
  type POStatus,
  type PurchaseOrder,
  type UpdateVendorPayload,
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

export async function updateVendorAction(vendorId: string, payload: UpdateVendorPayload): Promise<ActionResult> {
  try {
    await updateVendor(vendorId, payload);
    revalidatePath(`/finanzas/proveedores/${vendorId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addProductAction(vendorId: string, payload: CreateProductPayload): Promise<ActionResult> {
  try {
    await addVendorProduct(vendorId, payload);
    revalidatePath(`/finanzas/proveedores/${vendorId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createPurchaseOrderAction(
  vendorId: string,
  payload: CreatePurchaseOrderPayload,
): Promise<ActionResult> {
  try {
    await createPurchaseOrder(payload);
    revalidatePath(`/finanzas/proveedores/${vendorId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updatePOStatusAction(vendorId: string, poId: string, status: POStatus): Promise<ActionResult> {
  try {
    await updatePOStatus(poId, status);
    revalidatePath(`/finanzas/proveedores/${vendorId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createInvoiceAction(vendorId: string, payload: CreateInvoicePayload): Promise<ActionResult> {
  try {
    await createInvoice(payload);
    revalidatePath(`/finanzas/proveedores/${vendorId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeVendorDocumentAction(vendorId: string, docId: string): Promise<ActionResult> {
  try {
    await removeVendorDocument(docId);
    revalidatePath(`/finanzas/proveedores/${vendorId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function getPurchaseOrderDetailAction(poId: string): Promise<PurchaseOrder | null> {
  try {
    return await getPurchaseOrder(poId);
  } catch {
    return null;
  }
}
