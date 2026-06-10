import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // el cuerpo no es JSON, se usa el mensaje por defecto
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; name: string }[];
}

export type UserLocation = 'LEON' | 'CDMX' | 'GUADALAJARA';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  cognitoId: string | null;
  location: UserLocation | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  roles: { id: string; name: string }[];
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  location?: UserLocation;
  roleIds?: string[];
  isActive?: boolean;
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
  location?: UserLocation;
  roleIds?: string[];
  isActive?: boolean;
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me');
}

export function listUsers(): Promise<UserSummary[]> {
  return apiFetch<UserSummary[]>('/users');
}

export function listRoles(): Promise<RoleSummary[]> {
  return apiFetch<RoleSummary[]>('/roles');
}

export function createUser(payload: CreateUserPayload): Promise<UserSummary> {
  return apiFetch<UserSummary>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
  return apiFetch<UserSummary>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(`/users/${id}`, {
    method: 'DELETE',
  });
}
