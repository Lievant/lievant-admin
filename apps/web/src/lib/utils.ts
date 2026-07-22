import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha de tipo DATE (sin hora) como DD/MM/YYYY sin pasar por el
 * constructor Date, evitando el desfase de un día por zona horaria.
 * Ej: formatDateLocal('2026-07-01') → '01/07/2026'
 */
export function formatDateLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.substring(0, 10).split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}
