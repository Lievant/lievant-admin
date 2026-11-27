import type { TicketSurveyRating } from '@/lib/api';

/** Opciones de la encuesta: carita + texto (nunca solo color ni solo emoji). */
export const SURVEY_OPTIONS: { value: TicketSurveyRating; label: string; emoji: string }[] = [
  { value: 'feliz', label: 'Feliz', emoji: '😀' },
  { value: 'normal', label: 'Normal', emoji: '😐' },
  { value: 'triste', label: 'Triste', emoji: '🙁' },
  { value: 'enojado', label: 'Enojado', emoji: '😠' },
];

export const SURVEY_COMMENT_MAX = 1000;

export function surveyOption(rating: TicketSurveyRating) {
  return SURVEY_OPTIONS.find((o) => o.value === rating) ?? SURVEY_OPTIONS[1]!;
}
