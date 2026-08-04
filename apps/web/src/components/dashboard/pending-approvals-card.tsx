'use client';

import { useEffect, useState } from 'react';
import type { PendingApprovalItem } from '@/lib/api';
import { CheckIcon, CloseIcon } from '@/components/icons';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(iso: string): string {
  const parts = iso.slice(0, 10).split('-').map(Number);
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return `${d} ${MONTHS[m - 1]}`;
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const abbr = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
      {abbr}
    </span>
  );
}

export function PendingApprovalsCard() {
  const [items, setItems] = useState<PendingApprovalItem[] | null>(null);
  const [rejecting, setRejecting] = useState<PendingApprovalItem | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/vacations/pending-approvals');
      if (res.ok) {
        setItems((await res.json()) as PendingApprovalItem[]);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approve(item: PendingApprovalItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/vacations/requests/${item.id}/approve`, { method: 'PATCH' });
      if (!res.ok) throw new Error('No se pudo aprobar.');
      setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting || reason.trim().length < 3) return;
    setBusyId(rejecting.id);
    setError(null);
    try {
      const res = await fetch(`/api/vacations/requests/${rejecting.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) throw new Error('No se pudo rechazar.');
      const id = rejecting.id;
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
      setRejecting(null);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setBusyId(null);
    }
  }

  // Se oculta por completo si no hay solicitudes pendientes.
  if (!items || items.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy">Solicitudes pendientes de aprobación</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {items.length}
        </span>
      </div>

      {error && <p className="mb-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
          >
            <Avatar name={item.employee.fullName} photoUrl={item.employee.photoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy">{item.employee.fullName}</p>
              <p className="text-xs text-slate-500">
                {formatDate(item.startDate)} – {formatDate(item.endDate)} · {item.workingDaysTaken} día
                {item.workingDaysTaken === 1 ? '' : 's'}
                {item.substitute ? ` · Sustituto: ${item.substitute.fullName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => approve(item)}
                disabled={busyId === item.id}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Aprobar
              </button>
              <button
                type="button"
                onClick={() => { setRejecting(item); setReason(''); setError(null); }}
                disabled={busyId === item.id}
                className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <CloseIcon className="h-3.5 w-3.5" />
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Modal de rechazo */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-navy">Rechazar solicitud</h3>
            <p className="mt-1 text-xs text-slate-500">
              {rejecting.employee.fullName} · {formatDate(rejecting.startDate)} – {formatDate(rejecting.endDate)}
            </p>
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Razón del rechazo
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              placeholder="Explica el motivo (obligatorio)…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setRejecting(null); setReason(''); }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={reason.trim().length < 3 || busyId === rejecting.id}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === rejecting.id ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
