'use client';

import { useCurrentUser } from '@/components/user-provider';

export function usePermission(section: string, module: string, action?: string): boolean {
  const user = useCurrentUser();
  if (!user) return false;

  return user.permissions.some(
    (p) =>
      p.section === section &&
      p.module === module &&
      (action === undefined || p.action === action),
  );
}
