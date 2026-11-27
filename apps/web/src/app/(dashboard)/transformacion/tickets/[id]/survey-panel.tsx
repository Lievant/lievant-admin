'use client';

import { useEffect, useState } from 'react';
import type { TicketSurveyState } from '@/lib/api';
import { SurveyAnswer } from '@/app/(dashboard)/herramientas/soporte/survey-section';

/** "Encuesta de satisfacción" en el detalle para TD: la respuesta o "Sin responder". */
export function SurveyPanel({ ticketId }: { ticketId: string }) {
  const [state, setState] = useState<TicketSurveyState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}/survey`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as TicketSurveyState;
      })
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Encuesta de satisfacción</h2>
      {failed ? (
        <p className="text-xs text-red-600">No se pudo cargar la encuesta.</p>
      ) : !state ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : state.survey ? (
        <SurveyAnswer survey={state.survey} />
      ) : (
        <p className="text-sm text-slate-500">Sin responder</p>
      )}
    </div>
  );
}
