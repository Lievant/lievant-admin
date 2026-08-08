'use client';

import type { CardReportStatus, CreditCardItem } from '@/lib/api';

export { DocumentHeader, Hint, formatDate, formatDateTime, money } from '../mis-reembolsos/expense-shared';

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
