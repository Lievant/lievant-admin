'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { MyTicketDetail } from '@/lib/api';
import { attentionTime, slaStatus } from './ticket-sla';
import { SurveyAnswer, SurveyForm } from './survey-section';
import { requesterActions } from './ticket-requester-actions';
import { PRIORITY_STYLES, SLA_TONE_STYLES, STATUS_LABELS, STATUS_STYLES, formatDateTime } from './ticket-display';

interface Props {
  ticketId: string;
  onClose: () => void;
}

/**
 * Detalle de un ticket propio. Muestra las notas de solución del técnico; las
 * notas internas y el diagnóstico no llegan del API.
 */
export function TicketDetailModal({ ticketId, onClose }: Props) {
  const [ticket, setTicket] = useState<MyTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setTicket(null);
    setError(null);
    fetch(`/api/helpdesk/tickets/my/${encodeURIComponent(ticketId)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 404) throw new Error('No encontramos este ticket entre los tuyos.');
        if (!res.ok) throw new Error('No se pudo cargar el ticket. Intenta de nuevo.');
        return (await res.json()) as MyTicketDetail;
      })
      .then((t) => !cancelled && setTicket(t))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'No se pudo cargar el ticket.'));
    return () => {
      cancelled = true;
    };
  }, [ticketId, reloadKey]);

  /** Acciones del solicitante; el API valida que el ticket sea suyo. */
  async function runAction(path: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}/${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
        throw new Error(msg || 'No se pudo completar la acción.');
      }
      setReloadKey((k) => k + 1);
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sla = ticket ? slaStatus(ticket) : null;
  const attention = ticket ? attentionTime(ticket) : null;
  const actions = ticket ? requesterActions(ticket) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-xl border border-slate-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-slate-400">{ticket?.displayId ?? '…'}</p>
            <h2 id="ticket-modal-title" className="mt-0.5 break-words text-base font-semibold text-navy">
              {ticket ? `${ticket.categoryName ?? ticket.category}${ticket.subcategory ? ` — ${ticket.subcategory}` : ''}` : 'Detalle del ticket'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!ticket && !error && <p className="text-sm text-slate-400">Cargando…</p>}

          {ticket && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {ticket.priority && (
                  <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', PRIORITY_STYLES[ticket.priority])}>
                    {ticket.priority}
                  </span>
                )}
                <span className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_STYLES[ticket.status])}>
                  {STATUS_LABELS[ticket.status]}
                </span>
                {sla && sla.tone !== 'none' && (
                  <span className={cn('rounded px-2 py-0.5 text-xs font-medium', SLA_TONE_STYLES[sla.tone])}>
                    SLA: {sla.label}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Field label="Apertura" value={formatDateTime(ticket.requestedAt)} />
                <Field label="Cierre" value={ticket.closedAt ? formatDateTime(ticket.closedAt) : '—'} />
                {attention && <Field label="Tiempo de atención" value={attention} />}
                <Field label="Técnico asignado" value={ticket.assigneeName ?? 'Sin asignar'} />
                <Field label="Equipo" value={ticket.equipmentId ?? '—'} />
              </dl>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Descripción</h3>
                <p className="whitespace-pre-line break-words text-sm text-slate-700">{ticket.description}</p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Notas de solución</h3>
                {ticket.solution ? (
                  <p className="whitespace-pre-line break-words text-sm text-slate-700">{ticket.solution}</p>
                ) : (
                  <p className="text-sm text-slate-400">El técnico aún no registra la solución.</p>
                )}
              </section>

              {actions && (actions.canConfirm || actions.canReportRecurrence) && (
                <section className="space-y-2">
                  {actionError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {actions.canConfirm && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction('confirm-resolution')}
                        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                      >
                        Confirmar resolución
                      </button>
                    )}
                    {actions.canReportRecurrence && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction('status', { status: 'abierto', notes: 'Reapertura: problema recurrente.' })}
                        className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                      >
                        Reportar recurrencia
                      </button>
                    )}
                  </div>
                </section>
              )}

              {ticket.survey ? (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Tu calificación</h3>
                  <SurveyAnswer survey={ticket.survey} />
                </section>
              ) : (
                ticket.canAnswerSurvey && (
                  <section className="rounded-lg border border-slate-200 p-4">
                    <SurveyForm
                      ticketId={ticket.id}
                      onAnswered={(survey) => setTicket({ ...ticket, survey, canAnswerSurvey: false })}
                    />
                  </section>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700 sm:text-left">{value}</dd>
    </div>
  );
}
