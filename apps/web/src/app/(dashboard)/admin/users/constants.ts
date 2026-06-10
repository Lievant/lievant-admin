import type { UserLocation, UserSummary } from '@/lib/api';

export const LOCATIONS: UserLocation[] = ['LEON', 'CDMX', 'GUADALAJARA'];

export const LOCATION_LABELS: Record<UserLocation, string> = {
  LEON: 'León',
  CDMX: 'CDMX',
  GUADALAJARA: 'Guadalajara',
};

export const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-terracota/10 text-terracota-dark',
  ADMIN_FINANZAS: 'bg-blue-50 text-blue-600',
  ADMIN_RRHH: 'bg-blue-50 text-blue-600',
  ADMIN_NOMINA: 'bg-purple-50 text-purple-600',
  CUENTA_MANAGER: 'bg-amber-50 text-amber-600',
  VIEWER: 'bg-slate-100 text-slate-500',
};

export const DEFAULT_ROLE_BADGE = 'bg-slate-100 text-slate-500';

export type UserStatus = 'activo' | 'pendiente' | 'inactivo';

export const STATUS_LABELS: Record<UserStatus, string> = {
  activo: 'Activo',
  pendiente: 'Pendiente',
  inactivo: 'Inactivo',
};

export const STATUS_BADGE_STYLES: Record<UserStatus, string> = {
  activo: 'bg-green-50 text-green-600',
  pendiente: 'bg-amber-50 text-amber-600',
  inactivo: 'bg-slate-100 text-slate-500',
};

export function getUserStatus(user: UserSummary): UserStatus {
  if (user.deletedAt) return 'inactivo';
  if (!user.isActive && !user.cognitoId) return 'pendiente';
  return 'activo';
}

const AVATAR_COLORS = ['#c2714f', '#4a6fa5', '#5a7a6a', '#7a5a5a', '#6a4a7a', '#4a7a5a', '#7a6a4a'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#c2714f';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatLastLogin(value: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `${diffMin} min`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d`;

  return date.toLocaleDateString('es-MX');
}
