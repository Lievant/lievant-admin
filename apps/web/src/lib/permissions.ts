import type { CurrentUser } from './api';

export function isSuperAdmin(user: CurrentUser | null): boolean {
  return user?.roles.some((role) => role.name === 'SUPER_ADMIN') ?? false;
}

/**
 * Comprueba un permiso concreto del usuario actual. SUPER_ADMIN siempre pasa.
 * Sin usuario devuelve false: a diferencia del sidebar (que abre por defecto
 * para no quedar vacío si /auth/me falla), aquí un permiso no confirmado no
 * debe habilitar acciones sobre datos de otras personas.
 */
export function hasPermission(
  user: CurrentUser | null,
  section: string,
  module: string,
  action: string,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return user.permissions.some(
    (p) => p.section === section && p.module === module && p.action === action,
  );
}
