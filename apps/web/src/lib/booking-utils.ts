/**
 * Helpers de reservas para componentes cliente.
 *
 * Viven fuera de lib/api.ts a propósito: ese módulo abre con
 * `import { cookies } from 'next/headers'`, que solo existe en el servidor.
 * Importar de ahí un valor —no un tipo— desde un Client Component arrastra el
 * módulo entero al bundle del navegador y rompe `next build`, aunque `tsc` y
 * ESLint pasen sin quejarse. Los tipos se siguen importando de lib/api con
 * `import type`, que TypeScript borra al compilar.
 */

/** true si la cuenta de quien reservó ya no está vigente. */
export function isBookingUserInactive(
  user:
    | {
        isActive?: boolean;
        deletedAt?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return true;
  return !user.isActive || !!user.deletedAt;
}
