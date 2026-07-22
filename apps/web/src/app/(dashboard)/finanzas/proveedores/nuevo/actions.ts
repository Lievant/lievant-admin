'use server';

import { ApiError, createVendor, type CreateVendorPayload } from '@/lib/api';

export interface CreateVendorResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function createVendorAction(payload: CreateVendorPayload): Promise<CreateVendorResult> {
  try {
    const vendor = await createVendor(payload);
    return { success: true, id: vendor.id };
  } catch (err) {
    if (err instanceof ApiError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Ocurrió un error inesperado.' };
  }
}
