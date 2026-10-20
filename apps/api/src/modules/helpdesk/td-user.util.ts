import { User } from '../auth/entities/user.entity';

/**
 * ¿Es personal de Transformación Digital? SUPER_ADMIN o cualquier permiso del
 * módulo `tickets.gestion` (por rol o por permiso individual concedido). Es el
 * mismo criterio que muestra el recuadro "Apertura por TD" y la columna
 * "Asignado a" en la pantalla de tickets.
 */
export function isTdUser(user: Pick<User, 'roles' | 'userPermissions'>): boolean {
  return (
    user.roles?.some((r) => r.name === 'SUPER_ADMIN') ||
    user.userPermissions?.some((up) => up.granted && up.permission?.module === 'tickets.gestion') ||
    user.roles?.some((r) => r.permissions?.some((p) => p.module === 'tickets.gestion')) ||
    false
  );
}
