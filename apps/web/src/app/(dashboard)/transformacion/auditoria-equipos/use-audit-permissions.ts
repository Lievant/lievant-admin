'use client';

import { useCurrentUser } from '@/components/user-provider';

/**
 * Permisos de Auditoría de Equipos para decidir qué se muestra. El API es quien
 * manda (devuelve 403): esto solo evita pintar botones que no funcionarían.
 * Sin usuario resuelto se asume que puede, igual que Líneas Telefónicas.
 */
export function useAuditPermissions(): { canRead: boolean; canWrite: boolean } {
  const user = useCurrentUser();
  if (!user) return { canRead: true, canWrite: true };

  const isSuperAdmin = user.roles.some((r) => r.name === 'SUPER_ADMIN');
  const has = (action: string) =>
    user.permissions.some(
      (p) => p.section === 'transformacion' && p.module === 'auditoria-equipos' && p.action === action,
    );

  const canWrite = isSuperAdmin || has('write');
  return { canRead: canWrite || has('read'), canWrite };
}
