import type { SimCurrency, SimDeviceType, SimExpiryStatus, SimStatus } from '@/lib/api';

export const SIM_STATUS_LABEL: Record<SimStatus, string> = {
  activa: 'Activa',
  suspendida: 'Suspendida',
  cancelada: 'Cancelada',
};

export const SIM_STATUS_STYLE: Record<SimStatus, string> = {
  activa: 'bg-green-50 text-green-700',
  suspendida: 'bg-yellow-50 text-yellow-700',
  cancelada: 'bg-slate-200 text-slate-700',
};

export const SIM_DEVICE_LABEL: Record<SimDeviceType, string> = {
  smartphone: 'Smartphone',
  tablet: 'Tableta',
  modem: 'Módem',
  otro: 'Otro',
};

export const SIM_EXPIRY_LABEL: Record<SimExpiryStatus, string> = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  vencida: 'Vencida',
  sin_fecha: 'Sin fecha',
};

export const SIM_EXPIRY_STYLE: Record<SimExpiryStatus, string> = {
  vigente: 'bg-emerald-100 text-emerald-700',
  por_vencer: 'bg-amber-100 text-amber-700',
  vencida: 'bg-red-100 text-red-700',
  sin_fecha: 'bg-slate-100 text-slate-500',
};

export function formatMoney(amount: number, currency: SimCurrency): string {
  // Siempre "$ 1,234.50 MXN" / "$ 20.00 USD": con style 'currency' es-MX pinta USD como
  // texto ("USD 20.00") y la moneda saldría repetida.
  const number = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `$${number} ${currency}`;
}

/**
 * Fecha de calendario (AAAA-MM-DD) tal cual, sin pasar por `new Date()`: esa
 * conversión la toma como UTC y en México muestra el día anterior.
 */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
}

/** 10 dígitos → "477 123 4567". Cualquier otro formato se muestra como llegó. */
export function formatPhone(value: string): string {
  return /^\d{10}$/.test(value) ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}` : value;
}

export function formatTerm(months: number | null): string {
  if (!months) return '—';
  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
}

export const INPUT_CLASS =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:bg-slate-50 disabled:text-slate-500';
export const LABEL_CLASS = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

/** Mensaje de un cuerpo de error del API (string o arreglo de validaciones). */
export async function errorMessageOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    // el cuerpo no es JSON
  }
  return fallback;
}
