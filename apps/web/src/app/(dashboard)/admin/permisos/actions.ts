'use server';

import { revalidatePath } from 'next/cache';
import {
  ApiError,
  getUserPermissionOverrides,
  removeUserPermissionOverride,
  setUserPermission,
  type UserPermissionOverride,
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

export async function fetchUserOverridesAction(userId: string): Promise<UserPermissionOverride[]> {
  return getUserPermissionOverrides(userId);
}

export async function setUserPermissionAction(
  userId: string,
  permissionId: string,
  granted: boolean,
): Promise<ActionResult> {
  try {
    await setUserPermission(userId, permissionId, granted);
    revalidatePath('/admin/permisos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeUserPermissionAction(
  userId: string,
  permissionId: string,
): Promise<ActionResult> {
  try {
    await removeUserPermissionOverride(userId, permissionId);
    revalidatePath('/admin/permisos');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
