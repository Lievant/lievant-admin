'use client';

import { createContext, useContext } from 'react';
import type { CurrentUser } from '@/lib/api';

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({ user, children }: { user: CurrentUser | null; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser(): CurrentUser | null {
  return useContext(UserContext);
}
