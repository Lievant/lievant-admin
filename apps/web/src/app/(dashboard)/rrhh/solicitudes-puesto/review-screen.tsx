'use client';

import { ModalShell } from '../matriz-puestos/modal-shell';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';
import { RequisitionDetailView } from './requisition-detail-view';
import {
  PRIORITY_BADGE,
  STATUS_BADGE,
  STATUS_LABELS,
  formatDateTimeMx,
  priorityLabel,
  readApiError,
  typeLabel,
  type RequisitionDetail,
  type RequisitionPage,
  type RequisitionStatus,
} from './requisitions-constants';

interface Summary {
  pending: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

const PAGE_SIZE = 25;
const REVIEW_STATUSES: RequisitionStatus[] = ['enviada', 'aprobada', 'rechazada'];
const COLUMNS = ['Código', 'Solicitante', 'Tipo', 'Puesto', 'Área', 'Prioridad', 'Estado', 'Enviada'];
const SELECT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

function Card({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-2 text-3xl font-bold', tone)}>{value}</p>
    </div>
  );
}

export function ReviewScreen() {
  const canApprove = usePermission('rrhh', 'solicitudes-puesto', 'approve');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RequisitionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<RequisitionDetail | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Solo cuenta la respuesta de la consulta más reciente (si no, una respuesta lenta pisa a una nueva).
  const latest = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadSummary = useCallback(() => {
    fetch('/api/hr/job-requisitions/summary')
      .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
      .then((s) => s && setSummary(s))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadSummary();
    fetch('/api/hr/job-requisitions/options')
      .then((r) => (r.ok ? (r.json() as Promise<{ areas: string[] }>) : null))
      .then((o) => o && setAreas(o.areas))
      .catch(() => undefined);
  }, [loadSummary]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ticket = ++latest.current;
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status) q.set('status', status);
    if (area) q.set('area', area);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (debounced) q.set('search', debounced);
    try {
      const res = await fetch(`/api/hr/job-requisitions?${q}`);
      if (!res.ok) throw new Error((await readApiError(res, 'No se pudo cargar la lista.')).message);
      const data = (await res.json()) as RequisitionPage;
      if (ticket === latest.current) setResult(data);
    } catch (err) {
      if (ticket !== latest.current) return;
      setResult(null);
      setError(err instanceof Error ? err.message : 'No se pudo cargar la lista.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [page, status, area, from, to, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    set(e.target.value);
    setPage(1);
  };

  const openDetail = async (id: string) => {
    setActionError(null);
    setRejecting(false);
    setComments('');
    const res = await fetch(`/api/hr/job-requisitions/${id}`);
    if (!res.ok) return setError((await readApiError(res, 'No se pudo abrir la solicitud.')).message);
    setDetail((await res.json()) as RequisitionDetail);
  };

  const resolve = async (kind: 'approve' | 'reject') => {
    if (!detail) return;
    if (kind === 'reject' && !comments.trim()) return setActionError('Escribe los comentarios del rechazo.');
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/hr/job-requisitions/${detail.id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: comments.trim() || null }),
      });
      if (!res.ok) throw new Error((await readApiError(res, 'No se pudo resolver la solicitud.')).message);
      setDetail((await res.json()) as RequisitionDetail);
      setRejecting(false);
      setComments('');
      loadSummary();
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo resolver la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = Boolean(status || area || from || to || debounced);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-black">RRHH</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Solicitudes de Puesto</h1>
        <p className="mt-1 text-sm text-slate-500">Solicitudes enviadas por los líderes para abrir o cubrir un puesto</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card label="Pendientes" value={summary?.pending ?? '—'} tone="text-amber-600" />
        <Card label="Aprobadas Este Mes" value={summary?.approvedThisMonth ?? '—'} tone="text-emerald-600" />
        <Card label="Rechazadas Este Mes" value={summary?.rejectedThisMonth ?? '—'} tone="text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="rv-search" className={LABEL}>Buscar</label>
          <input id="rv-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Código o puesto" className={SELECT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rv-status" className={LABEL}>Estado</label>
          <select id="rv-status" value={status} onChange={onFilter(setStatus)} className={SELECT}>
            <option value="">Todos</option>
            {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rv-area" className={LABEL}>Área</label>
          <select id="rv-area" value={area} onChange={onFilter(setArea)} className={SELECT}>
            <option value="">Todas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rv-from" className={LABEL}>Enviada Desde</label>
          <input id="rv-from" type="date" value={from} max={to || undefined} onChange={onFilter(setFrom)} className={SELECT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rv-to" className={LABEL}>Enviada Hasta</label>
          <input id="rv-to" type="date" value={to} min={from || undefined} onChange={onFilter(setTo)} className={SELECT} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && !result ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : result && result.total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          {filtered ? 'No Hay Solicitudes Con Esos Filtros' : 'Aún No Hay Solicitudes Enviadas'}
        </div>
      ) : (
        result && (
          <>
            <div className={cn('max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', loading && 'opacity-60')}>
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {COLUMNS.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-600">{r.code}</td>
                      <td className="px-4 py-3 text-slate-600">{r.requesterName ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{typeLabel(r.type)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openDetail(r.id)} className="text-left font-medium text-navy hover:underline">{r.positionLabel ?? 'Sin puesto'}</button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.area}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.priority ? <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', PRIORITY_BADGE[r.priority])}>{priorityLabel(r.priority)}</span> : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE[r.status])}>{STATUS_LABELS[r.status]}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTimeMx(r.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
              <span>{result.total} {result.total === 1 ? 'solicitud' : 'solicitudes'} · Página {result.page} de {result.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={loading || result.page <= 1} onClick={() => setPage(result.page - 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50">Anterior</button>
                <button type="button" disabled={loading || result.page >= result.totalPages} onClick={() => setPage(result.page + 1)} className="rounded-md border border-slate-200 px-3 py-1.5 font-medium hover:border-slate-300 disabled:opacity-50">Siguiente</button>
              </div>
            </div>
          </>
        )
      )}

      {detail && (
        <ModalShell
          maxWidth="max-w-2xl"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              {canApprove && detail.status === 'enviada' && (
                <>
                  <button type="button" disabled={busy} onClick={() => { setRejecting(true); void resolve('reject'); }} className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">Rechazar</button>
                  <button type="button" disabled={busy} onClick={() => resolve('approve')} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">Aprobar</button>
                </>
              )}
              <button type="button" onClick={() => setDetail(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cerrar</button>
            </div>
          }
        >
          <RequisitionDetailView d={detail} showRequester />

          {canApprove && detail.status === 'enviada' && (
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="rv-comments" className={LABEL}>{rejecting ? 'Comentarios del Rechazo (Obligatorios)' : 'Comentarios (Opcionales al Aprobar, Obligatorios al Rechazar)'}</label>
                <textarea id="rv-comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} maxLength={5000} className={SELECT} />
              </div>
            </div>
          )}

          {actionError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
        </ModalShell>
      )}
    </div>
  );
}
