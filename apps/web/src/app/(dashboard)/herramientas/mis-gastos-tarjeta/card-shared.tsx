'use client';

import type { CardReportStatus, CreditCardItem } from '@/lib/api';

import { Hint } from '../mis-reembolsos/expense-shared';

export { DocumentHeader, Hint, formatDate, formatDateTime, money } from '../mis-reembolsos/expense-shared';

const ASIGNACION = 'Con esta asignación el gasto se envía al departamento que le corresponda.';

/** Explicación por tipo de gasto (nombres del catálogo). Única fuente para todas las pantallas. */
const EXPENSE_TYPE_INFO: Record<string, string> = {
  'Viáticos cliente': 'El gasto lo asume directamente el cliente.',
  'Costo operativo': 'El gasto lo asume el área operativa (costo de operación).',
  'Costo de venta / temas comerciales':
    'El gasto lo asume el área de venta/comercial (área de la división).',
  'Costo de Marketing': 'Temas de marketing (Marketing de la División).',
};

/** Tipo fuera del mapa: texto general, sin romper la fila. */
export function expenseTypeInfo(typeName: string | null | undefined): string {
  const base = (typeName && EXPENSE_TYPE_INFO[typeName]) || 'Tipo de gasto sin descripción específica.';
  return `${base} ${ASIGNACION}`;
}

/** Ícono "i" de la fila: no se guarda, se calcula del tipo seleccionado. */
export function ExpenseTypeInfo({ typeName }: { typeName: string | null | undefined }) {
  return <Hint text={expenseTypeInfo(typeName)} />;
}

/** Solo tres estados: el gasto de tarjeta no pasa por autorización. */
export const CARD_STATUS_META: Record<CardReportStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Enviado', className: 'bg-amber-100 text-amber-700' },
  processed: { label: 'Procesado', className: 'bg-sky-100 text-sky-700' },
};

export function CardStatusBadge({ status }: { status: CardReportStatus }) {
  const meta = CARD_STATUS_META[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

/** "•••• •••• •••• 1234 — Alias — Titular". */
export function describeCard(card: CreditCardItem | null | undefined): string {
  if (!card) return '—';
  const partes = [`•••• •••• •••• ${card.lastFour}`];
  if (card.alias) partes.push(card.alias);
  if (card.holderEmployee?.fullName) partes.push(card.holderEmployee.fullName);
  return partes.join(' — ');
}

export function maskedCard(card: CreditCardItem | null | undefined): string {
  return card ? `•••• ${card.lastFour}` : '—';
}
