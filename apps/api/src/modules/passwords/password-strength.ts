/**
 * Fortaleza de una contraseña: solo informa, nunca bloquea el guardado (una
 * cuenta de cliente puede imponer una contraseña corta que no elegimos). El
 * modal del front repite esta regla para la barra en tiempo real.
 *
 * - fuerte: 12+ caracteres con números, mayúsculas y símbolos.
 * - débil: menos de 8 caracteres, o sin números, o sin mayúsculas.
 * - media: el resto.
 */
export type PasswordStrength = 'debil' | 'media' | 'fuerte';

export const WEAK_PASSWORD_WARNING = 'La contraseña es débil. Te recomendamos cambiarla por una más segura.';

export function reusedPasswordWarning(applicationName: string): string {
  return `Esta contraseña ya se usa en ${applicationName}. Te recomendamos usar contraseñas únicas para cada herramienta.`;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasDigit = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  if (password.length >= 12 && hasDigit && hasUpper && hasSymbol) return 'fuerte';
  if (password.length < 8 || !hasDigit || !hasUpper) return 'debil';
  return 'media';
}
