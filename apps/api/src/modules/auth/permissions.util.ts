import { User } from './entities/user.entity';

/**
 * Comprueba un permiso sobre el User ya cargado en la request, con la misma
 * precedencia que PermissionsGuard: SUPER_ADMIN pasa siempre, un override
 * individual gana sobre el rol, y si no hay override se resuelve por roles.
 *
 * Sirve para decisiones dentro de un servicio (p. ej. "puede gestionar reservas
 * ajenas") donde el guard no aplica porque el endpoint es accesible a todos y
 * lo que cambia es el alcance, no el acceso.
 */
export function userHasPermission(
  user: Pick<User, 'roles' | 'userPermissions'>,
  section: string,
  module: string,
  action: string,
): boolean {
  if (user.roles?.some((role) => role.name === 'SUPER_ADMIN')) return true;

  const override = user.userPermissions?.find(
    (up) =>
      up.permission?.section === section &&
      up.permission?.module === module &&
      up.permission?.action === action,
  );
  if (override !== undefined) return override.granted;

  return (
    user.roles?.some((role) =>
      role.permissions?.some(
        (p) => p.section === section && p.module === module && p.action === action,
      ),
    ) ?? false
  );
}
