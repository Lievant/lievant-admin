import type { UserLocation, UserSummary } from '@/lib/api';

export const LOCATIONS: UserLocation[] = ['LEON', 'CDMX', 'GUADALAJARA', 'COLOMBIA', 'ESTADOS_UNIDOS'];

export const LOCATION_LABELS: Record<UserLocation, string> = {
  LEON: 'León',
  CDMX: 'CDMX',
  GUADALAJARA: 'Guadalajara',
  COLOMBIA: 'Colombia',
  ESTADOS_UNIDOS: 'Estados Unidos',
};

export const ROLE_BADGE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-terracota/10 text-terracota-dark',
  DIRECTOR: 'bg-blue-50 text-blue-600',
  COLABORADOR: 'bg-slate-100 text-slate-500',
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
