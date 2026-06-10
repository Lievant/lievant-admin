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
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; name: string }[];
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: { id: string; name: string }[];
}

export interface RoleSummary {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
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
