import type { TicketSatisfactionFilter } from '@/lib/api';
import { SURVEY_OPTIONS } from '../../herramientas/soporte/survey-ratings';

/** Valores válidos del filtro ?satisfaction= (los demás se ignoran). */
export const SATISFACTION_VALUES: readonly TicketSatisfactionFilter[] = [
  ...SURVEY_OPTIONS.map((o) => o.value),
  'sin_responder',
];

export const SATISFACTION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Satisfacción: Todas' },
  ...SURVEY_OPTIONS.map((o) => ({ value: o.value, label: `${o.emoji} ${o.label}` })),
  { value: 'sin_responder', label: 'Sin responder' },
];

/** Carita + texto: no depende solo del color ni solo del emoji. */
export function SatisfactionCell({ value }: { value: TicketSatisfactionFilter | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  if (value === 'sin_responder') return <span className="text-slate-500">Sin responder</span>;
  const option = SURVEY_OPTIONS.find((o) => o.value === value);
  if (!option) return <span className="text-slate-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-slate-700">
      <span aria-hidden="true">{option.emoji}</span>
      {option.label}
    </span>
  );
}
