'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TicketSurveyItem, TicketSurveyRating } from '@/lib/api';
import { SURVEY_COMMENT_MAX, SURVEY_OPTIONS, surveyOption } from './survey-ratings';
import { formatDateTime } from './ticket-display';

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return message || fallback;
}

/** Respuesta ya enviada, en solo lectura. */
export function SurveyAnswer({ survey }: { survey: TicketSurveyItem }) {
  const opt = surveyOption(survey.rating);
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
      <p className="font-medium text-slate-700">
        <span aria-hidden="true" className="mr-1.5">{opt.emoji}</span>
        {opt.label}
      </p>
      {survey.comment && <p className="mt-1 whitespace-pre-line break-words text-slate-600">{survey.comment}</p>}
      <p className="mt-1 text-xs text-slate-400">Respondida el {formatDateTime(survey.createdAt)}</p>
    </div>
  );
}

/** "¿Cómo fue la atención?": 4 opciones y observaciones opcionales. Se responde una sola vez. */
export function SurveyForm({ ticketId, onAnswered }: { ticketId: string; onAnswered: (s: TicketSurveyItem) => void }) {
  const [rating, setRating] = useState<TicketSurveyRating | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!rating) return setError('Elige una opción.');
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}/survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
      });
      const body = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) return setError(errorMessage(body, 'No se pudo enviar tu respuesta.'));
      onAnswered(body as TicketSurveyItem);
    } catch {
      setError('No se pudo enviar tu respuesta.');
    } finally {
      setSending(false);
    }
  }

  return (
    <fieldset className="space-y-3" disabled={sending}>
      <legend className="text-sm font-medium text-navy">¿Cómo fue la atención?</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
        {SURVEY_OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-sm transition-colors',
              rating === o.value
                ? 'border-black bg-black/5 font-semibold text-black'
                : 'border-slate-200 text-slate-600 hover:border-slate-300',
            )}
          >
            <input
              type="radio"
              name={`survey-${ticketId}`}
              value={o.value}
              checked={rating === o.value}
              onChange={() => setRating(o.value)}
              className="sr-only"
            />
            <span aria-hidden="true" className="text-2xl leading-none">{o.emoji}</span>
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <div>
        <label htmlFor={`survey-comment-${ticketId}`} className="mb-1 block text-xs font-medium text-slate-500">
          Observaciones (opcional)
        </label>
        <textarea
          id={`survey-comment-${ticketId}`}
          rows={3}
          maxLength={SURVEY_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <p className="text-right text-xs text-slate-400">
          {comment.length}/{SURVEY_COMMENT_MAX}
        </p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending || !rating}
        className="w-full rounded-md bg-black py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto sm:px-4"
      >
        {sending ? 'Enviando…' : 'Enviar calificación'}
      </button>
    </fieldset>
  );
}
