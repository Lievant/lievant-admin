/**
 * Importe en número → importe en letras, para los contratos de servicios.
 *
 * Los contratos escriben el monto dos veces: `$45,000.00 MX (CUARENTA Y CINCO
 * MIL PESOS 00/100 M.N)`. Esta función genera la segunda forma para que quien
 * llena el contrato no la teclee a mano y se equivoque.
 */

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = [
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE',
  'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
];
const VEINTES = [
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO',
  'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
  'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

function decenas(n: number): string {
  if (n < 10) return UNIDADES[n] ?? '';
  if (n < 20) return DIEZ_A_DIECINUEVE[n - 10] ?? '';
  if (n < 30) return VEINTES[n - 20] ?? '';
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] ?? '' : `${DECENAS[d] ?? ''} Y ${UNIDADES[u] ?? ''}`;
}

function centenas(n: number): string {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const prefijo = CENTENAS[c] ?? '';
  if (resto === 0) return prefijo;
  return prefijo ? `${prefijo} ${decenas(resto)}` : decenas(resto);
}

function miles(n: number): string {
  if (n < 1000) return centenas(n);
  const m = Math.floor(n / 1000);
  const resto = n % 1000;
  // "MIL", no "UN MIL".
  const prefijo = m === 1 ? 'MIL' : `${centenas(m)} MIL`;
  return resto === 0 ? prefijo : `${prefijo} ${centenas(resto)}`;
}

function millones(n: number): string {
  if (n < 1_000_000) return miles(n);
  const m = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const prefijo = m === 1 ? 'UN MILLÓN' : `${miles(m)} MILLONES`;
  return resto === 0 ? prefijo : `${prefijo} ${miles(resto)}`;
}

/**
 * Devuelve el importe en el formato que usan los contratos:
 * `CUARENTA Y CINCO MIL PESOS 00/100 M.N`.
 * Cadena vacía si el importe no es un número válido.
 */
export function montoALetras(monto: number | string): string {
  const valor = typeof monto === 'number' ? monto : Number(String(monto).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(valor) || valor < 0) return '';

  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);
  const letras = entero === 0 ? 'CERO' : millones(entero);
  const plural = entero === 1 ? 'PESO' : 'PESOS';

  return `${letras} ${plural} ${String(centavos).padStart(2, '0')}/100 M.N`;
}

/** Formatea 45000 → "45,000.00" para el hueco del monto numérico. */
export function formatearMonto(monto: number | string): string {
  const valor = typeof monto === 'number' ? monto : Number(String(monto).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(valor)) return '';
  return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
