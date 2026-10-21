import { BadRequestException } from '@nestjs/common';
import { todayInMexico } from '../../../common/business-date';

export const SIM_EXPIRY_WARNING_DAYS = 30;

export type SimExpiryStatus = 'vigente' | 'por_vencer' | 'vencida' | 'sin_fecha';

function toUtcDay(date: string): number | null {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d);
}

/** Días de `date` a hoy (hora de México); negativo = ya pasó. null si la fecha no es válida. */
export function daysUntil(date: string, now: Date = new Date()): number | null {
  const target = toUtcDay(date);
  const today = toUtcDay(todayInMexico(now));
  if (target === null || today === null) return null;
  return Math.round((target - today) / 86_400_000);
}

/**
 * Semáforo del vencimiento del contrato. Igual que `warrantyStatus()` del
 * inventario: una línea que vence hoy sigue "por vencer" hoy, no "vencida" desde
 * el primer minuto. La diferencia es que el "hoy" es el de México, no el del
 * reloj del servidor (que en ECS corre en UTC).
 */
export function expiryStatus(date: string | null | undefined, now: Date = new Date()): SimExpiryStatus {
  if (!date) return 'sin_fecha';
  const days = daysUntil(date, now);
  if (days === null) return 'sin_fecha';
  if (days < 0) return 'vencida';
  if (days <= SIM_EXPIRY_WARNING_DAYS) return 'por_vencer';
  return 'vigente';
}

/**
 * Número a 10 dígitos (México). Acepta espacios, guiones, paréntesis y el prefijo
 * +52 (o +521, el antiguo de celulares).
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
  if (digits.length !== 10) {
    throw new BadRequestException('El número de la línea debe tener 10 dígitos (se acepta el prefijo +52).');
  }
  return digits;
}

/** ICCID: solo dígitos (19 o 20 en la práctica); texto vacío = sin ICCID. */
export function normalizeIccid(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s-]/g, '');
  if (!/^\d{18,22}$/.test(digits)) {
    throw new BadRequestException('El ICCID debe tener entre 18 y 22 dígitos.');
  }
  return digits;
}

/** El costo propio de la SIM manda; si no hay, hereda el del plan (con su moneda). */
export function effectiveCost(
  simCost: number | null,
  simCurrency: string,
  planCost: number,
  planCurrency: string,
): { amount: number; currency: string } {
  return simCost !== null ? { amount: simCost, currency: simCurrency } : { amount: planCost, currency: planCurrency };
}

/**
 * Avisos (no bloqueantes) cuando la persona de la línea no coincide con la
 * asignación vigente del equipo al que está asociada.
 */
export function buildWarnings(input: {
  employeeId: string | null;
  employeeName: string | null;
  equipmentId: string | null;
  equipmentDisplayId: string | null;
  equipmentEmployeeId: string | null;
  equipmentEmployeeName: string | null;
}): string[] {
  if (!input.equipmentId || !input.employeeId) return [];
  const equipment = input.equipmentDisplayId ?? 'el equipo';
  if (!input.equipmentEmployeeId) {
    return [`El equipo ${equipment} no tiene una persona asignada; la línea está asignada a ${input.employeeName ?? 'otra persona'}.`];
  }
  if (input.equipmentEmployeeId !== input.employeeId) {
    return [
      `La línea está asignada a ${input.employeeName ?? 'otra persona'}, pero el equipo ${equipment} está asignado a ${input.equipmentEmployeeName ?? 'otra persona'}.`,
    ];
  }
  return [];
}

/** El pg entrega NUMERIC como string. */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}
