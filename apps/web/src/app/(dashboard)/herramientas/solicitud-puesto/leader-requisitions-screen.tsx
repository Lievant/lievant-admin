'use client';

import { ModalShell } from '@/app/(dashboard)/rrhh/matriz-puestos/modal-shell';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { RequisitionDetailView } from '@/app/(dashboard)/rrhh/solicitudes-puesto/requisition-detail-view';
import { RequisitionFormDialog, type PositionOption } from '@/app/(dashboard)/rrhh/solicitudes-puesto/requisition-form-dialog';
import {
  PRIORITY_BADGE,
  STATUS_BADGE,
  STATUS_LABELS,
  formatDay,
  priorityLabel,
  readApiError,
  typeLabel,
  type RequisitionDetail,
  type RequisitionPage,
  type RequisitionStatus,
} from '@/app/(dashboard)/rrhh/solicitudes-puesto/requisitions-constants';

const PAGE_SIZE = 25;
const COLUMNS = ['Código', 'Tipo', 'Puesto', 'Prioridad', 'Estado', 'Fecha'];
const SELECT = 'rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none';

type Blocked = { code: string; message: string } | null;

export function LeaderRequisitionsScreen() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<RequisitionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked>(null);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [leaderArea, setLeaderArea] = useState('');

  const [form, setForm] = useState<RequisitionDetail | 'new' | null>(null);
  const [viewing, setViewing] = useState<RequisitionDetail | null>(null);
  const [toDelete, setToDelete] = useState<RequisitionDetail | null>(null);
  const [toSend, setToSend] = useState<RequisitionDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Solo cuenta la respuesta de la consulta más reciente (si no, una respuesta lenta pisa a una nueva).
  const latest = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ticket = ++latest.current;
    const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (status) q.set('status', status);
    try {
      const res = await fetch(`/api/hr/job-requisitions/my?${q}`);
      if (!res.ok) {
        const err = await readApiError(res, 'No se pudo cargar tus solicitudes.');
        if (ticket !== latest.current) return;
        if (res.status === 403 && (err.code === 'NOT_A_LEADER' || err.code === 'EMPLOYEE_NOT_LINKED')) {
          setBlocked({ code: err.code, message: err.message });
          return;
        }
        throw new Error(err.message);
      }
      const data = (await res.json()) as RequisitionPage;
      if (ticket === latest.current) {
        setBlocked(null);
        setResult(data);
      }
    } catch (err) {
      if (ticket !== latest.current) return;
      setResult(null);
      setError(err instanceof Error ? err.message : 'No se pudo cargar tus solicitudes.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Datos del formulario: puestos de la Matriz (mínimos) y área del líder.
  useEffect(() => {
    if (blocked) return;
    fetch('/api/hr/job-requisitions/my/position-options')
      .then((r) => (r.ok ? (r.json() as Promise<PositionOption[]>) : []))
      .then(setPositions)
      .catch(() => undefined);
    fetch('/api/employees/my-profile')
      .then((r) => (r.ok ? (r.json() as Promise<{ laboral?: { area?: string | null } }>) : null))
      .then((p) => setLeaderArea(p?.laboral?.area ?? ''))
      .catch(() => undefined);
  }, [blocked]);

  const open = async (id: string, thenEdit: boolean) => {
    setActionError(null);
    const res = await fetch(`/api/hr/job-requisitions/my/${id}`);
    if (!res.ok) return setError((await readApiError(res, 'No se pudo abrir la solicitud.')).message);
    const d = (await res.json()) as RequisitionDetail;
    if (thenEdit && d.status === 'borrador') setForm(d);
    else setViewing(d);
  };

  const run = async (fn: () => Promise<Response>, fallback: string, after: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fn();
      if (!res.ok) throw new Error((await readApiError(res, fallback)).message);
      after();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  if (blocked) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-navy">Solicitud de Puesto</h1>
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">{blocked.message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">Solicitud de Puesto</h1>
          <p className="mt-1 text-sm text-slate-500">Solicita un puesto nuevo o cubrir una vacante; RRHH la revisa y la aprueba o rechaza.</p>
        </div>
        <button type="button" onClick={() => setForm('new')} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Nueva Solicitud</button>
      </div>

      <div className="flex flex-col gap-1 sm:w-56">
        <label htmlFor="lr-status" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</label>
        <select id="lr-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={SELECT}>
          <option value="">Todos</option>
          {(Object.keys(STATUS_LABELS) as RequisitionStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && !result ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : result && result.total === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
          {status ? 'No Hay Solicitudes Con Ese Estado' : 'Aún No Has Creado Solicitudes'}
        </div>
      ) : (
        result && (
          <>
            <div className={cn('max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm', loading && 'opacity-60')}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {COLUMNS.map((c) => <th key={c} className="whitespace-nowrap px-4 py-3">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.data.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-600">{r.code}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{typeLabel(r.type)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => open(r.id, false)} className="text-left font-medium text-navy hover:underline">{r.positionLabel ?? 'Sin puesto'}</button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.priority ? <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', PRIORITY_BADGE[r.priority])}>{priorityLabel(r.priority)}</span> : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE[r.status])}>{STATUS_LABELS[r.status]}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDay((r.submittedAt ?? r.createdAt).slice(0, 10))}</td>
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

      {form && (
        <RequisitionFormDialog
          draft={form === 'new' ? null : form}
          positions={positions}
          defaultArea={leaderArea}
          onClose={() => setForm(null)}
          onDone={() => {
            setForm(null);
            void load();
          }}
        />
      )}

      {viewing && (
        <ModalShell
          maxWidth="max-w-2xl"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              {viewing.status === 'borrador' && (
                <>
                  <button type="button" onClick={() => { setToDelete(viewing); setViewing(null); }} className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Eliminar</button>
                  <button type="button" onClick={() => { setForm(viewing); setViewing(null); }} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Editar</button>
                  <button type="button" onClick={() => { setToSend(viewing); setViewing(null); }} className="rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800">Enviar a RRHH</button>
                </>
              )}
              <button type="button" onClick={() => setViewing(null)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cerrar</button>
            </div>
          }
        >
          <RequisitionDetailView d={viewing} />
          {actionError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
        </ModalShell>
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">Eliminar Borrador</h2>
            <p className="mt-3 text-sm text-slate-600">¿Eliminar el borrador <strong>{toDelete.code}</strong>?</p>
            {actionError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setToDelete(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
              <button type="button" disabled={busy} onClick={() => run(() => fetch(`/api/hr/job-requisitions/my/${toDelete.id}`, { method: 'DELETE' }), 'No se pudo eliminar el borrador.', () => { setToDelete(null); void load(); })} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">Enviar a RRHH</h2>
            <p className="mt-3 text-sm text-slate-600">Al enviar <strong>{toSend.code}</strong>, la solicitud queda en solo lectura y RRHH la revisará. ¿Quieres enviarla?</p>
            {actionError && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setToSend(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300">Cancelar</button>
              <button type="button" disabled={busy} onClick={() => run(() => fetch(`/api/hr/job-requisitions/my/${toSend.id}/submit`, { method: 'POST' }), 'No se pudo enviar la solicitud.', () => { setToSend(null); void load(); })} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
