'use client';

import type { Booking } from '@/lib/api';
import { CloseIcon } from '@/components/icons';
import {
  BOOKING_STATUS_BADGE_STYLES,
  BOOKING_STATUS_LABELS,
  formatDateLabel,
  formatDurationLabel,
  formatTimeLabel,
} from '../constants';
import { cn } from '@/lib/utils';

interface BookingDetailModalProps {
  booking: Booking;
  /** Nombre de la sala: en el calendario viene de la lista de salas, no de booking.room. */
  roomName: string;
  officeName: string;
  /** booking.userId === currentUser.id */
  isOwner: boolean;
  /** Tiene permiso herramientas.salas.manage */
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}

export function BookingDetailModal({
  booking,
  roomName,
  officeName,
  isOwner,
  canManage,
  onClose,
  onEdit,
  onCancel,
}: BookingDetailModalProps) {
  // Solo el dueño de la reserva o quien tenga salas.manage puede modificarla.
  // Para el resto el modal es informativo.
  const canAct = isOwner || canManage;
  // Una reserva ya cancelada no se edita ni se vuelve a cancelar.
  const isCancelled = booking.status === 'cancelada';
  const showActions = canAct && !isCancelled;

  const reservante = booking.user?.name ?? booking.user?.email ?? 'Sin asignar';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 id="booking-detail-title" className="truncate text-lg font-bold text-navy">
              {booking.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Detalle de la reserva</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-semibold',
                BOOKING_STATUS_BADGE_STYLES[booking.status],
              )}
            >
              {BOOKING_STATUS_LABELS[booking.status]}
            </span>
            {isOwner && <span className="text-xs font-medium text-slate-400">Tu reserva</span>}
          </div>

          <dl className="space-y-3 text-sm">
            <Field label="Sala" value={officeName ? `${roomName} · ${officeName}` : roomName} />
            <Field label="Fecha" value={formatDateLabel(booking.startTime)} />
            <Field
              label="Horario"
              value={`${formatTimeLabel(booking.startTime)} – ${formatTimeLabel(booking.endTime)} (${formatDurationLabel(
                booking.startTime,
                booking.endTime,
              )})`}
            />
            <Field label="Reservante" value={reservante} />
            {booking.notes && <Field label="Notas" value={booking.notes} />}
            {(booking.attendees ?? []).length > 0 && (
              <Field
                label="Invitados"
                value={booking.attendees.map((a) => a.name ?? a.email).join(', ')}
              />
            )}
          </dl>

          {!canAct && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Solo puedes consultar esta reserva. Para modificarla, contacta a {reservante} o a un
              gestor de salas.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              Cerrar
            </button>
            {showActions && (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:border-red-300"
                >
                  Cancelar reserva
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Editar reserva
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-navy">{value}</dd>
    </div>
  );
}
