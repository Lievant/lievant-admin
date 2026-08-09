'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BellIcon,
  CheckIcon,
  CloseIcon,
  DoorIcon,
  HeadsetIcon,
  PlaneIcon,
  TicketIcon,
} from '@/components/icons';
import { useNotifications, type NotificationItem } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

interface PaginatedResponse {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

type FilterKey = 'todas' | 'no_leida' | 'informativa' | 'pendientes';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'no_leida', label: 'No leídas' },
  { key: 'informativa', label: 'Informativas' },
  { key: 'pendientes', label: 'Acciones pendientes' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

/** Ícono por módulo de origen; la campana es el genérico. */
function moduleIcon(module: string | null) {
  switch (module) {
    case 'vacaciones':
      return PlaneIcon;
    case 'helpdesk':
      return HeadsetIcon;
    case 'tickets':
      return TicketIcon;
    case 'salas':
      return DoorIcon;
    default:
      return BellIcon;
  }
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

/** "hace 5 minutos", "ayer", "hace 3 días"… */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 45) return 'hace unos segundos';
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

  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_STYLES: Record<NotificationItem['status'], { label: string; className: string }> = {
  no_leida: { label: 'No leída', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  leida: { label: 'Leída', className: 'bg-slate-50 text-slate-500 border-slate-200' },
  aceptada: { label: 'Aceptada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazada: { label: 'Rechazada', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function StatusBadge({ status }: { status: NotificationItem['status'] }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', s.className)}>
      {s.label}
    </span>
  );
}

// ── componente ───────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const router = useRouter();
  const { latestNotification, refreshUnreadCount } = useNotifications();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Nota por notificación, para las de tipo accion_con_nota y atencion.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Marcar una baja como atendida es irreversible y afecta a otra área: se
  // confirma antes.
  const [confirmingAtencion, setConfirmingAtencion] = useState<NotificationItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter !== 'todas') params.set('status', filter);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('No se pudieron cargar las notificaciones.');

      const data = (await res.json()) as PaginatedResponse;
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Llega una nueva por WebSocket: se recarga para respetar el filtro activo.
  useEffect(() => {
    if (latestNotification) void load();
  }, [latestNotification, load]);

  async function markAsRead(item: NotificationItem) {
    if (item.status !== 'no_leida') return;
    try {
      await fetch(`/api/notifications/${item.id}/read`, { method: 'PATCH' });
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, status: 'leida' as const } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      void refreshUnreadCount();
    } catch {
      // Marcar como leída no es crítico: si falla, se reintenta al reabrir.
    }
  }

  async function openNotification(item: NotificationItem) {
    await markAsRead(item);
    if (item.actionUrl) router.push(item.actionUrl);
  }

  async function markAllAsRead() {
    setError(null);
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
      if (!res.ok) throw new Error('No se pudieron marcar como leídas.');
      void refreshUnreadCount();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    }
  }

  async function respond(item: NotificationItem, action: 'aceptada' | 'rechazada') {
    setBusyId(item.id);
    setError(null);
    try {
      const note = notes[item.id]?.trim();
      const res = await fetch(`/api/notifications/${item.id}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(note ? { note } : {}) }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'No se pudo registrar la respuesta.');
      }

      setNotes((prev) => ({ ...prev, [item.id]: '' }));
      void refreshUnreadCount();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellIcon className="h-6 w-6 text-navy" />
          <h1 className="text-xl font-semibold text-navy">Mis Notificaciones</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Marcar todas como leídas
        </button>
      </header>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); setPage(1); }}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition',
              filter === f.key
                ? 'border-black bg-black text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}

      {/* ── Lista ───────────────────────────────────────────────────────── */}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
          <BellIcon className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No tienes notificaciones aquí.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = moduleIcon(item.module);
            const unread = item.status === 'no_leida';
            const needsResponse =
              (item.type === 'accion' ||
                item.type === 'accion_con_nota' ||
                item.type === 'atencion') &&
              unread;

            return (
              <li
                key={item.id}
                className={cn(
                  'rounded-xl border bg-white p-4 transition',
                  unread ? 'border-slate-300 bg-blue-50/20' : 'border-slate-200',
                )}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void openNotification(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void openNotification(item);
                    }
                  }}
                  className="flex cursor-pointer items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                      unread ? 'bg-black text-white' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          'text-sm text-navy',
                          unread ? 'font-bold' : 'font-normal',
                        )}
                      >
                        {item.title}
                      </p>
                      <StatusBadge status={item.status} />
                    </div>

                    <p className="mt-1 text-sm text-slate-600">{item.message}</p>

                    <p className="mt-1.5 text-xs text-slate-400">
                      {item.senderName ?? 'Sistema'} · {relativeTime(item.createdAt)}
                    </p>

                    {item.responseNote && (
                      <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">
                        Nota: {item.responseNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* Acciones — fuera del área clicable para no navegar al responder */}
                {needsResponse && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {(item.type === 'accion_con_nota' || item.type === 'atencion') && (
                      <textarea
                        value={notes[item.id] ?? ''}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Nota (opcional)…"
                        className="mb-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    )}

                    {/* 'atencion' es de una sola vía: no hay nada que rechazar,
                        solo confirmar que ya se ejecutó. */}
                    {item.type === 'atencion' ? (
                      <button
                        type="button"
                        onClick={() => setConfirmingAtencion(item)}
                        disabled={busyId === item.id}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                        Atendido
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void respond(item, 'aceptada')}
                          disabled={busyId === item.id}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                          Aceptar
                        </button>
                        <button
                          type="button"
                          onClick={() => void respond(item, 'rechazada')}
                          disabled={busyId === item.id}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <CloseIcon className="h-3.5 w-3.5" />
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Paginación ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-500">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {confirmingAtencion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-atendido"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="confirmar-atendido" className="text-base font-semibold text-navy">
              ¿Confirmas que completaste todas las tareas correspondientes a esta baja?
            </h3>
            <p className="mt-2 text-sm text-slate-600">{confirmingAtencion.title}</p>

            <textarea
              rows={2}
              value={notes[confirmingAtencion.id] ?? ''}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [confirmingAtencion.id]: e.target.value }))
              }
              placeholder="Nota (opcional)…"
              className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingAtencion(null)}
                disabled={busyId === confirmingAtencion.id}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = confirmingAtencion;
                  setConfirmingAtencion(null);
                  void respond(item, 'aceptada');
                }}
                disabled={busyId === confirmingAtencion.id}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Sí, atendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
