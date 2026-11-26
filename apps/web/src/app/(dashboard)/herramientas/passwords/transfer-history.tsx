'use client';

import { useEffect, useState } from 'react';
import type { AccountTransferItem } from '@/lib/api';

/** "26 nov 2026, 10:42" en hora de México. */
function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}

/**
 * Historial de transferencias de una cuenta (del más reciente al más antiguo):
 * fecha, de quién a quién, quién lo hizo y el motivo. Solo lectura.
 */
export function TransferHistory({ accountId }: { accountId: string }) {
  const [rows, setRows] = useState<AccountTransferItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/passwords/${encodeURIComponent(accountId)}/transfers`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as AccountTransferItem[];
        if (!cancelled) setRows(Array.isArray(body) ? body : []);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (failed) return <p className="text-xs text-rose-600">No se pudo cargar el historial de transferencias.</p>;
  if (rows === null) return <p className="text-xs text-slate-400">Cargando…</p>;
  if (rows.length === 0) return <p className="text-xs text-slate-500">Esta cuenta no se ha transferido.</p>;

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="text-slate-400">{formatDateTime(r.createdAt)}</p>
          <p className="mt-0.5">
            <span className="font-medium text-navy">{r.from.fullName}</span> →{' '}
            <span className="font-medium text-navy">{r.to.fullName}</span>
          </p>
          <p className="mt-0.5">Hecha por {r.transferredBy.name}</p>
          {r.reason && <p className="mt-0.5 italic">«{r.reason}»</p>}
        </li>
      ))}
    </ul>
  );
}
