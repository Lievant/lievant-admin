'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellIcon } from '@/components/icons';
import { useNotifications, type NotificationItem } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 45) return 'hace un momento';
  if (seconds < HOUR) {
    const m = Math.max(1, Math.floor(seconds / MINUTE));
    return `hace ${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  }

  const days = Math.floor(seconds / DAY);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const STATUS_LABEL: Record<NotificationItem['status'], { label: string; className: string }> = {
  no_leida: { label: 'Nueva', className: 'bg-blue-50 text-blue-700' },
  leida: { label: 'Leída', className: 'bg-slate-100 text-slate-500' },
  aceptada: { label: 'Aceptada', className: 'bg-emerald-50 text-emerald-700' },
  rechazada: { label: 'Rechazada', className: 'bg-rose-50 text-rose-700' },
};

/** Trunca sin cortar a media palabra. */
function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`;
}

/**
 * Widget del dashboard: las 5 notificaciones más recientes.
 *
 * Comparte `useNotifications` con el sidebar, así que el badge y la lista se
 * mueven juntos cuando entra una notificación nueva por WebSocket.
 */
export function NotificationsCard() {
  const { unreadCount, latestNotification } = useNotifications();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/recent');
      setItems(res.ok ? ((await res.json()) as NotificationItem[]) : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recarga al llegar una nueva para mantener el orden del servidor.
  useEffect(() => {
    if (latestNotification) void load();
  }, [latestNotification, load]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <BellIcon className="h-4 w-4 text-slate-400" />
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Últimas notificaciones
        </p>
        {unreadCount > 0 && (
          <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {items === null ? (
        <p className="text-xs text-slate-400">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400">Sin notificaciones por ahora.</p>
      ) : (
        <ul className="flex-1 space-y-1.5">
          {items.map((n) => {
            const badge = STATUS_LABEL[n.status];
            return (
              <li key={n.id}>
                <Link
                  href="/herramientas/mis-notificaciones"
                  className="block rounded-md px-2 py-1.5 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        'truncate text-xs text-navy',
                        n.status === 'no_leida' ? 'font-semibold' : 'font-normal',
                      )}
                    >
                      {n.title}
                    </p>
                    <span
                      className={cn(
                        'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        badge.className,
                      )}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {truncate(n.message)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{relativeTime(n.createdAt)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/herramientas/mis-notificaciones"
        className="mt-2 inline-block text-xs font-medium text-black underline-offset-2 hover:underline"
      >
        Ver todas →
      </Link>
    </div>
  );
}
