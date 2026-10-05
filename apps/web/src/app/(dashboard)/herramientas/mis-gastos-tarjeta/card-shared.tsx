'use client';

import type { CardReportStatus, CreditCardItem } from '@/lib/api';

import { Hint } from '../mis-reembolsos/expense-shared';

export { DocumentHeader, Hint, formatDate, formatDateTime, money } from '../mis-reembolsos/expense-shared';

/** Texto de la celda "Información" por tipo de gasto (nombres del catálogo). Única fuente para todas las vistas. */
const EXPENSE_TYPE_INFO: Record<string, string> = {
  'Viáticos cliente': 'Lo asume directamente el cliente',
  'Costo operativo': 'Costo de operación',
  'Costo de venta / temas comerciales': 'Área de la división',
  'Costo de Marketing': 'Marketing de la división',
};

/** Tipo fuera del mapa: texto vacío. */
export function expenseTypeInfo(typeName: string | null | undefined): string {
  return (typeName && EXPENSE_TYPE_INFO[typeName]) || '';
}

/** Celda de solo lectura: se calcula del tipo de la fila, no se guarda. */
export function ExpenseTypeInfoCell({ typeName }: { typeName: string | null | undefined }) {
  return (
    <span className="block min-w-[220px] whitespace-normal text-xs text-slate-500">
      {expenseTypeInfo(typeName)}
    </span>
  );
}

/** Encabezado "Información" con la "i" explicativa general (igual que Factura). */
export function ExpenseTypeInfoHeader() {
  return (
    <>
      Información
      <Hint text="Costo de operación: lo asume el área operativa. Área de la división: venta/comercial. Marketing de la División: temas de marketing. Viáticos cliente: lo asume directamente el cliente. Con esta asignación el gasto se envía al departamento que le corresponda." />
    </>
  );
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
