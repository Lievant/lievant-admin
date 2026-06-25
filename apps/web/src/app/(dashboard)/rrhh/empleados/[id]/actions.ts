'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  addEmployeeContact,
  createEmployeeVacation,
  generateEmployeeDocument,
  removeEmployeeContact,
  updateEmployee,
  updateEmployeeCompensation,
  updateEmployeeContact,
  updateEmployeePersonalData,
  updateEmployeeTermination,
  updateEmployeeVacation,
  type CreateEmergencyContactPayload,
  type CreateVacationPayload,
  type EmployeeDocumentType,
  type UpdateCompensationPayload,
  type UpdateEmergencyContactPayload,
  type UpdateEmployeePayload,
  type UpdatePersonalDataPayload,
  type UpdateTerminationPayload,
  type UpdateVacationPayload,
} from '@/lib/api';

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface GenerateDocumentActionResult extends ActionResult {
  base64?: string;
}

function toResult(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Ocurrió un error inesperado.' };
}

export async function updateEmployeeAction(employeeId: string, payload: UpdateEmployeePayload): Promise<ActionResult> {
  try {
    await updateEmployee(employeeId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updatePersonalDataAction(
  employeeId: string,
  payload: UpdatePersonalDataPayload,
): Promise<ActionResult> {
  try {
    await updateEmployeePersonalData(employeeId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCompensationAction(
  employeeId: string,
  payload: UpdateCompensationPayload,
): Promise<ActionResult> {
  try {
    await updateEmployeeCompensation(employeeId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function createVacationAction(employeeId: string, payload: CreateVacationPayload): Promise<ActionResult> {
  try {
    await createEmployeeVacation(employeeId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateVacationAction(
  employeeId: string,
  vacationId: string,
  payload: UpdateVacationPayload,
): Promise<ActionResult> {
  try {
    await updateEmployeeVacation(vacationId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function addContactAction(
  employeeId: string,
  payload: CreateEmergencyContactPayload,
): Promise<ActionResult> {
  try {
    await addEmployeeContact(employeeId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateContactAction(
  employeeId: string,
  contactId: string,
  payload: UpdateEmergencyContactPayload,
): Promise<ActionResult> {
  try {
    await updateEmployeeContact(contactId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeContactAction(employeeId: string, contactId: string): Promise<ActionResult> {
  try {
    await removeEmployeeContact(contactId);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateTerminationAction(
  employeeId: string,
  payload: UpdateTerminationPayload,
): Promise<ActionResult> {
  try {
    await updateEmployeeTermination(employeeId, payload);
    revalidatePath(`/rrhh/empleados/${employeeId}`);
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function generateEmployeeDocumentAction(
  employeeId: string,
  docType: EmployeeDocumentType,
  extraParams?: Record<string, string>,
): Promise<GenerateDocumentActionResult> {
  try {
    const doc = await generateEmployeeDocument(employeeId, docType, extraParams ?? {});
    return { success: true, base64: doc.base64 };
  } catch (err) {
    return toResult(err);
  }
}
