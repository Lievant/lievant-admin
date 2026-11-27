'use client';

import { useEffect, useState } from 'react';
import type { SurveySummary } from '@/lib/api';
import { SURVEY_OPTIONS } from '@/app/(dashboard)/herramientas/soporte/survey-ratings';

/** Fecha YYYY-MM-DD en hora de México (la misma zona que usa el API). */
function ymdMexico(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function minusDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - days * 86_400_000).toISOString().slice(0, 10);
}

const pct = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`;

/**
 * Indicadores de la encuesta de satisfacción (solo TD). Si el API responde 403
 * (quien ve el tablero no es TD), la sección no se muestra.
 */
export function SatisfactionSummary() {
  const today = ymdMexico(new Date());
  const [from, setFrom] = useState(minusDays(today, 29));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<SurveySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/helpdesk/surveys/summary?from=${from}&to=${to}`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }
        const body = (await res.json().catch(() => null)) as (SurveySummary & { message?: string | string[] }) | null;
        if (!res.ok) {
          const msg = Array.isArray(body?.message) ? body?.message[0] : body?.message;
          throw new Error(msg || 'No se pudieron cargar los indicadores.');
        }
        if (!cancelled) setData(body);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Error al cargar.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  if (forbidden) return null;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Satisfacción</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            aria-label="Desde"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:outline-none"
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            aria-label="Hasta"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:outline-none"
          />
        </div>
        {loading && <span className="text-xs text-slate-400">Cargando…</span>}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {data && !error && data.total === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
          Sin respuestas en este rango
          {data.enviadas > 0 && ` (${data.enviadas} ${data.enviadas === 1 ? 'encuesta enviada' : 'encuestas enviadas'})`}.
        </p>
      )}

      {data && !error && data.total > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card label="Respuestas" value={String(data.total)} />
            <Card
              label="Satisfacción"
              value={data.satisfaccionPct != null ? pct(data.satisfaccionPct) : '—'}
              detail={`de ${data.total} ${data.total === 1 ? 'respuesta' : 'respuestas'} (Feliz)`}
            />
            <Card
              label="Tasa de respuesta"
              value={data.tasaRespuestaPct != null ? pct(data.tasaRespuestaPct) : '—'}
              detail={`${data.respondidasDeEnviadas} de ${data.enviadas} enviadas`}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {SURVEY_OPTIONS.map((o) => (
              <div key={o.value} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span aria-hidden="true" className="text-base">{o.emoji}</span>
                  {o.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">{data.porCalificacion[o.value]}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
