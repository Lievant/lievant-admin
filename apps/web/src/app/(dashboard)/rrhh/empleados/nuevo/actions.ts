'use server';

import {
  ApiError,
  createEmployee,
  updateEmployeeCompensation,
  updateEmployeePersonalData,
  type CreateEmployeePayload,
  type UpdateCompensationPayload,
  type UpdatePersonalDataPayload,
} from '@/lib/api';

export interface CreateEmployeeResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function createEmployeeAction(
  payload: CreateEmployeePayload,
  personalPayload?: UpdatePersonalDataPayload,
  compensationPayload?: UpdateCompensationPayload,
): Promise<CreateEmployeeResult> {
  try {
    const employee = await createEmployee(payload);

    if (personalPayload && Object.keys(personalPayload).length > 0) {
      await updateEmployeePersonalData(employee.id, personalPayload);
    }
    if (compensationPayload && Object.keys(compensationPayload).length > 0) {
      await updateEmployeeCompensation(employee.id, compensationPayload);
    }

    return { success: true, id: employee.id };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
