'use client';

import { useEffect, useState } from 'react';
import type { VacationRequestDetail, VacationRequestStatus } from '@/lib/api';
import { CloseIcon } from '@/components/icons';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? '—' : t.toLocaleString('es-MX');
}

const STATUS_META: Record<VacationRequestStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', className: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelada', className: 'bg-slate-100 text-slate-600' },
};

/** Etiqueta + valor, con el vacío ya resuelto para no repetirlo en cada fila. */
function Field({ label, value, hint }: { label: string; value: string | null; hint?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value?.trim() ? value : <span className="text-slate-400">—</span>}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export interface VacationRequestDetailModalProps {
  requestId: string;
  onClose: () => void;
  /** Muestra el nombre y cargo del colaborador (vistas de RRHH y notificaciones). */
  showEmployee?: boolean | undefined;
  /**
   * Acciones del pie. Cada una se dibuja solo si el contenedor la pasa, porque
   * lo que se puede hacer con una solicitud depende de la pantalla: en
   * notificaciones el Aceptar/Rechazar vive en la tarjeta y el modal es de
   * lectura, así que ahí no se pasa ninguna.
   *
   * El '| undefined' explícito es por exactOptionalPropertyTypes: los
   * contenedores pasan la acción condicionada al permiso.
   */
  onApprove?: ((id: string) => void) | undefined;
  onReject?: ((id: string, reason: string) => void) | undefined;
  onDelete?: ((id: string) => void) | undefined;
  /** Etiqueta del botón de borrado: 'Eliminar' en RRHH, 'Cancelar solicitud' para el dueño. */
  deleteLabel?: string | undefined;
  actionPending?: boolean | undefined;
  actionError?: string | null | undefined;
}

export function VacationRequestDetailModal({
  requestId,
  onClose,
  showEmployee = false,
  onApprove,
  onReject,
  onDelete,
  deleteLabel = 'Eliminar',
  actionPending = false,
  actionError = null,
}: VacationRequestDetailModalProps) {
  const [detail, setDetail] = useState<VacationRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // El textarea de rechazo aparece al pulsar el botón en lugar de ocupar sitio
  // en un modal que casi siempre es de solo lectura. La nota es opcional: el
  // rechazo de RRHH suele responder a una razón administrativa que ya consta
  // en otro lado.
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/vacations/requests/${requestId}`, { cache: 'no-store' });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? 'No se pudo cargar la solicitud.');
        }
        const data = (await res.json()) as VacationRequestDetail;
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error inesperado.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const respondida = detail !== null && detail.status !== 'pending';
  const puedeAprobar = detail?.status === 'pending' && !!onApprove;
  const puedeRechazar = detail?.status === 'pending' && !!onReject;
  const puedeBorrar = !!onDelete && (detail?.status === 'pending' || detail?.status === 'approved');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalle-solicitud-titulo"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="detalle-solicitud-titulo" className="text-base font-semibold text-navy">
                Solicitud de vacaciones
              </h3>
              {detail && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[detail.status].className}`}
                >
                  {STATUS_META[detail.status].label}
                </span>
              )}
            </div>
            {detail && (
              <p className="mt-0.5 font-mono text-xs text-slate-400">{detail.displayId}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* ── Cuerpo ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Cargando…</p>
          ) : error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          ) : detail ? (
            <div className="space-y-5">
              {showEmployee && (
                <Field
                  label="Colaborador"
                  value={detail.employee.fullName}
                  hint={[detail.employee.position, detail.employee.area].filter(Boolean).join(' · ') || null}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Fechas"
                  value={`Del ${formatDate(detail.startDate)} al ${formatDate(detail.endDate)}`}
                />
                <Field
                  label="Días hábiles"
                  value={`${detail.workingDaysTaken} ${detail.workingDaysTaken === 1 ? 'día' : 'días'}`}
                />
              </div>

              <section className="space-y-4 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detalles de la solicitud
                </h4>

                <Field label="Notas del solicitante" value={detail.notes ?? 'Sin notas'} />

                <Field
                  label="Persona que puede reemplazarle"
                  value={detail.substitute?.fullName ?? 'No especificado'}
                  hint={
                    detail.substitute
                      ? [detail.substitute.position, detail.substitute.area].filter(Boolean).join(' · ') || null
                      : null
                  }
                />

                <Field
                  label="Debe aprobar"
                  value={detail.approver?.fullName ?? 'Sin jefe asignado'}
                  hint={detail.approver?.position ?? null}
                />

                {detail.createdByAdmin && (
                  <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                    Esta solicitud fue levantada por Recursos Humanos en nombre del colaborador.
                  </p>
                )}
              </section>

              {respondida && (
                <section className="space-y-4 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Respuesta</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Respondido por"
                      value={detail.respondedBy?.fullName ?? 'No registrado'}
                      hint={detail.respondedBy?.position ?? null}
                    />
                    <Field label="Fecha de respuesta" value={formatDateTime(detail.respondedAt)} />
                  </div>
                  <Field label="Nota del aprobador" value={detail.authorizationNote ?? 'Sin nota'} />
                </section>
              )}
            </div>
          ) : null}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-6 py-4">
          {actionError && (
            <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {actionError}
            </p>
          )}

          {rejecting && detail && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Motivo del rechazo (opcional)…"
              className="mb-3 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {puedeAprobar && !rejecting && (
              <button
                type="button"
                onClick={() => onApprove?.(requestId)}
                disabled={actionPending}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
              >
                Aprobar
              </button>
            )}

            {puedeRechazar && (
              <button
                type="button"
                onClick={() => {
                  if (!rejecting) {
                    setRejecting(true);
                    return;
                  }
                  onReject?.(requestId, reason.trim());
                }}
                disabled={actionPending}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {rejecting ? 'Confirmar rechazo' : 'Rechazar'}
              </button>
            )}

            {puedeBorrar && !rejecting && (
              <button
                type="button"
                onClick={() => onDelete?.(requestId)}
                disabled={actionPending}
                className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
              >
                {deleteLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (rejecting) {
                  setRejecting(false);
                  setReason('');
                  return;
                }
                onClose();
              }}
              disabled={actionPending}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {rejecting ? 'Cancelar' : 'Cerrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
