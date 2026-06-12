import type { EmployeeStatus, Modality } from '@/lib/api';

export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'inactive'];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
};

export const EMPLOYEE_STATUS_BADGE_STYLES: Record<EmployeeStatus, string> = {
  active: 'bg-green-50 text-green-600',
  inactive: 'bg-slate-100 text-slate-500',
};

export const MODALITIES: Modality[] = ['presencial', 'hibrido', 'remoto'];

export const MODALITY_LABELS: Record<Modality, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
};

export const MODALITY_BADGE_STYLES: Record<Modality, string> = {
  presencial: 'bg-blue-50 text-blue-600',
  hibrido: 'bg-purple-50 text-purple-600',
  remoto: 'bg-emerald-50 text-emerald-600',
};

export function modalityFromCatalogName(name: string): Modality | null {
  const entry = (Object.entries(MODALITY_LABELS) as [Modality, string][]).find(([, label]) => label === name);
  return entry ? entry[0] : null;
}

export const GENDERS: { value: string; label: string }[] = [
  { value: 'Masculino', label: 'Masculino' },
  { value: 'Femenino', label: 'Femenino' },
  { value: 'Otro', label: 'Otro' },
];

export const MARITAL_STATUSES: { value: string; label: string }[] = [
  { value: 'Soltero(a)', label: 'Soltero(a)' },
  { value: 'Casado(a)', label: 'Casado(a)' },
  { value: 'Unión libre', label: 'Unión libre' },
  { value: 'Divorciado(a)', label: 'Divorciado(a)' },
  { value: 'Viudo(a)', label: 'Viudo(a)' },
];

export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export const CONTRACT_TYPES: { value: string; label: string }[] = [
  { value: 'Indeterminado', label: 'Indeterminado' },
  { value: 'Determinado', label: 'Determinado' },
  { value: 'Por obra', label: 'Por obra' },
  { value: 'Honorarios', label: 'Honorarios' },
];

export function companyBadgeStyle(companyName: string): string {
  const name = companyName.toLowerCase();
  if (name.includes('lievant')) return 'bg-purple-50 text-purple-600';
  if (name.includes('databeans')) return 'bg-blue-50 text-blue-600';
  if (name.includes('triciclo')) return 'bg-green-50 text-green-600';
  if (name.includes('estrategia')) return 'bg-amber-50 text-amber-600';
  return 'bg-slate-100 text-slate-600';
}

export function calculateSeniority(seniorityDate: string | null): string {
  if (!seniorityDate) return '—';

  const start = new Date(seniorityDate);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return '—';

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${remainingMonths} mes${remainingMonths === 1 ? '' : 'es'}`;
  if (remainingMonths === 0) return `${years} año${years === 1 ? '' : 's'}`;
  return `${years} año${years === 1 ? '' : 's'} ${remainingMonths} mes${remainingMonths === 1 ? '' : 'es'}`;
}

export function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  const now = new Date();
  if (Number.isNaN(birth.getTime())) return null;

  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

export function isContractExpiringSoon(contractEndDate: string | null): boolean {
  if (!contractEndDate) return false;

  const end = new Date(contractEndDate);
  if (Number.isNaN(end.getTime())) return false;

  const now = new Date();
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatCurrency(value: string | null): string {
  if (value == null) return '—';
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
