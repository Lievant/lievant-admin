'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  addBrand,
  addClientCompany,
  addClientContact,
  removeClientContact,
  removeClientDocument,
  updateClient,
  updateClientContact,
  updateClientFinancial,
  type CompanyPayload,
  type CreateContactPayload,
  type UpdateClientPayload,
  type UpdateContactPayload,
  type UpdateFinancialPayload,
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

export async function updateClientAction(clientId: string, payload: UpdateClientPayload): Promise<ActionResult> {
  try {
    await updateClient(clientId, payload);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addCompanyAction(clientId: string, payload: CompanyPayload): Promise<ActionResult> {
  try {
    await addClientCompany(clientId, payload);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addBrandAction(clientId: string, companyId: string, name: string): Promise<ActionResult> {
  try {
    await addBrand(companyId, { name });
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateFinancialAction(clientId: string, payload: UpdateFinancialPayload): Promise<ActionResult> {
  try {
    await updateClientFinancial(clientId, payload);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeDocumentAction(clientId: string, docId: string): Promise<ActionResult> {
  try {
    await removeClientDocument(docId);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addContactAction(clientId: string, payload: CreateContactPayload): Promise<ActionResult> {
  try {
    await addClientContact(clientId, payload);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateContactAction(
  clientId: string,
  contactId: string,
  payload: UpdateContactPayload,
): Promise<ActionResult> {
  try {
    await updateClientContact(contactId, payload);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeContactAction(clientId: string, contactId: string): Promise<ActionResult> {
  try {
    await removeClientContact(contactId);
    revalidatePath(`/finanzas/clientes/${clientId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
