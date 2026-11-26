/**
 * ¿Es personal de Transformación Digital? Mismo criterio que `isTdUser` del API
 * (apps/api/src/modules/helpdesk/td-user.util.ts): SUPER_ADMIN o cualquier
 * permiso del módulo `tickets.gestion`. `/auth/me` ya entrega los permisos
 * efectivos (rol + individuales concedidos, sin los denegados).
 *
 * Antes cada pantalla aceptaba además el rol TECNICO_TD por nombre, que el API
 * no reconoce: un usuario así veía el recuadro "Apertura por TD", pero el API
 * le devolvía sus propios equipos y rechazaba el ticket en nombre de otro.
 */
export function isTdFromMe(
  me: { roles: { name: string }[]; permissions: { module: string }[] } | null | undefined,
): boolean {
  if (!me) return false;
  return me.roles.some((r) => r.name === 'SUPER_ADMIN') || me.permissions.some((p) => p.module === 'tickets.gestion');
}
