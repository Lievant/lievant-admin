'use server';

import { revalidatePath } from 'next/cache';
import { ApiError, createUser, deleteUser, updateUser } from '@/lib/api';
import type { UserLocation } from '@/lib/api';

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

export interface CreateUserInput {
  name: string;
  email: string;
  location: UserLocation;
  roleId: string;
}

export async function createUserAction(input: CreateUserInput): Promise<ActionResult> {
  try {
    await createUser({
      name: input.name,
      email: input.email,
      location: input.location,
      roleIds: input.roleId ? [input.roleId] : [],
      isActive: false,
    });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateUserRoleAction(id: string, roleId: string): Promise<ActionResult> {
  try {
    await updateUser(id, { roleIds: roleId ? [roleId] : [] });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function activateUserAction(id: string): Promise<ActionResult> {
  try {
    await updateUser(id, { isActive: true });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateUserAction(id: string): Promise<ActionResult> {
  try {
    await deleteUser(id);
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return toResult(err);
  }
}
