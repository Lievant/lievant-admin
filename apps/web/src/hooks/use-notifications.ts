'use client';

import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface NotificationItem {
  id: string;
  recipientId: string;
  senderId: string | null;
  senderName: string | null;
  title: string;
  message: string;
  type: 'informativa' | 'accion' | 'accion_con_nota';
  status: 'no_leida' | 'leida' | 'aceptada' | 'rechazada';
  responseNote: string | null;
  respondedAt: string | null;
  module: string | null;
  entityId: string | null;
  entityType: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

// El socket vive en el host de la API (sin el prefijo /api/v1) y cuelga del
// namespace /notifications.
function wsBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL_WS;
  if (explicit) return explicit.replace(/\/$/, '');

  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  return api.replace(/\/api\/v1\/?$/, '');
}

// ── conexión compartida ──────────────────────────────────────────────────────
//
// El sidebar, el widget del dashboard y la pantalla de notificaciones usan este
// hook a la vez. Con un socket por consumidor se abrirían tres conexiones por
// pestaña, así que la conexión y el estado viven a nivel de módulo y los
// componentes solo se suscriben.

interface SharedState {
  unreadCount: number;
  latest: NotificationItem | null;
}

type Subscriber = (state: SharedState) => void;

let socket: Socket | null = null;
let refCount = 0;
let connecting = false;
const state: SharedState = { unreadCount: 0, latest: null };
const subscribers = new Set<Subscriber>();

function emit(): void {
  // Copia nueva en cada emisión para que React detecte el cambio.
  const snapshot: SharedState = { ...state };
  subscribers.forEach((fn) => fn(snapshot));
}

function setUnread(count: number): void {
  state.unreadCount = Math.max(0, count);
  emit();
}

async function fetchUnreadCount(): Promise<void> {
  try {
    const res = await fetch('/api/notifications/unread-count');
    if (!res.ok) return;
    const data = (await res.json()) as { count?: number };
    if (typeof data.count === 'number') setUnread(data.count);
  } catch {
    // Sin sesión o API caída: se conserva el último conteo conocido.
  }
}

async function connect(): Promise<void> {
  if (socket || connecting) return;
  connecting = true;

  try {
    let token: string | null = null;
    try {
      const res = await fetch('/api/notifications/ws-token');
      if (res.ok) token = ((await res.json()) as { token: string | null }).token;
    } catch {
      token = null;
    }

    // Sin token no hay tiempo real; el conteo inicial ya se cargó por HTTP.
    if (!token || refCount === 0) return;

    const s = io(`${wsBaseUrl()}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    s.on('new_notification', (notification: NotificationItem) => {
      state.latest = notification;
      state.unreadCount += 1;
      emit();
    });

    // Conteo autoritativo del servidor tras leer o responder: evita que varias
    // pestañas abiertas se desincronicen.
    s.on('unread_count', (payload: { count: number }) => {
      setUnread(payload?.count ?? 0);
    });

    // Al reconectar se resincroniza: mientras estuvo caído pudieron llegar
    // notificaciones que el socket no vio.
    s.on('connect', () => {
      void fetchUnreadCount();
    });

    socket = s;
  } finally {
    connecting = false;
  }
}

function disconnectIfUnused(): void {
  if (refCount > 0) return;
  socket?.disconnect();
  socket = null;
}

/**
 * Conteo de no leídas y última notificación recibida, en tiempo real.
 *
 * La identidad del usuario no se pasa como parámetro: sale del JWT que valida
 * el gateway, porque un id enviado por el cliente permitiría suscribirse a las
 * notificaciones de otra persona.
 */
export function useNotifications() {
  const [local, setLocal] = useState<SharedState>({ ...state });

  const refreshUnreadCount = useCallback(() => fetchUnreadCount(), []);

  useEffect(() => {
    const subscriber: Subscriber = (next) => setLocal(next);
    subscribers.add(subscriber);
    refCount += 1;

    void fetchUnreadCount();
    void connect();

    return () => {
      subscribers.delete(subscriber);
      refCount -= 1;
      disconnectIfUnused();
    };
  }, []);

  return {
    unreadCount: local.unreadCount,
    latestNotification: local.latest,
    setUnreadCount: setUnread,
    refreshUnreadCount,
  };
}
