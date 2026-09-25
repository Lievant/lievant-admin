const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Hoy en la zona del navegador, como YYYY-MM-DD (toISOString daría la fecha UTC). */
export function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Días de hoy a la fecha (negativo si ya pasó). null si no hay fecha. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayIso().split('-').map(Number);
  const target = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  const today = Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1);
  return Math.round((target - today) / 86_400_000);
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*?-_=+';

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % max;
}

/**
 * 12 caracteres con al menos uno de cada clase. Sin 0/O ni 1/l/I: la
 * contraseña a veces se dicta o se transcribe.
 */
export function generatePassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [UPPER, LOWER, DIGITS, SYMBOLS].map((set) => set[randomIndex(set.length)]!);
  while (chars.length < length) chars.push(all[randomIndex(all.length)]!);
  // Fisher–Yates para que las cuatro obligatorias no queden al inicio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

export type PasswordStrength = 'debil' | 'media' | 'fuerte';

export function passwordStrength(password: string): PasswordStrength {
  const classes = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (password.length >= 12 && classes === 4) return 'fuerte';
  if (password.length >= 8 && classes >= 3) return 'media';
  return 'debil';
}

// Misma regla laxa que class-validator acepta en la práctica: algo@algo.tld.
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}
