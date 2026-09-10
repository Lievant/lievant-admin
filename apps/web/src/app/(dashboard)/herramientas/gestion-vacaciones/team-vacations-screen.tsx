'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ErrorKind, TeamVacationRow, VacationRequestItem, VacationRequestStatus } from '@/lib/api';
import { CheckIcon, CloseIcon, EyeIcon, PlaneIcon, UsersGroupIcon } from '@/components/icons';
import { VacationRequestDetailModal } from '@/components/vacation-request-detail-modal';
import { approveTeamVacationAction, rejectTeamVacationAction } from './actions';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

const STATUS_META: Record<VacationRequestStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', className: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelada', className: 'bg-slate-100 text-slate-600' },
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Iniciales como respaldo cuando el colaborador no tiene foto cargada. */
function initials(fullName: string): string {
  const partes = fullName.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? '';
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (a + b).toUpperCase();
}

function Avatar({ row }: { row: TeamVacationRow }) {
  const [failed, setFailed] = useState(false);
  const { photoUrl, fullName } = row.employee;

  if (!photoUrl || failed) {
    return (
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
        {initials(fullName)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl}
      alt={fullName}
      onError={() => setFailed(true)}
      className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
    />
  );
}

/**
 * Confirmación de aprobar/rechazar. Comparten diálogo porque solo cambian el
 * tono y si la nota es obligatoria; separarlos duplicaría el formulario.
 */
function DecisionDialog({
  request,
  employeeName,
  kind,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  request: VacationRequestItem;
  employeeName: string;
  kind: 'approve' | 'reject';
  pending: boolean;
  error: string | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const rechazo = kind === 'reject';
  const faltaMotivo = rechazo && note.trim().length < 3;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-vacaciones-titulo"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 id="decision-vacaciones-titulo" className="text-base font-semibold text-navy">
          {rechazo ? '¿Rechazar esta solicitud?' : '¿Aprobar esta solicitud?'}
        </h3>

        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-navy">{employeeName}</span> — del{' '}
          <span className="font-medium text-navy">{formatDate(request.startDate)}</span> al{' '}
          <span className="font-medium text-navy">{formatDate(request.endDate)}</span> (
          {request.workingDaysTaken} días hábiles).
        </p>

        {rechazo && (
          <p className="mt-2 text-sm text-slate-600">
            Los días volverán al saldo disponible del colaborador.
          </p>
        )}

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          {rechazo ? 'Motivo del rechazo' : 'Nota para el colaborador (opcional)'}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={rechazo ? 'Explica el motivo…' : 'Ej. de acuerdo, deja el traspaso al día.'}
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        />

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note)}
            disabled={pending || faltaMotivo}
            className={`rounded-md px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
              rechazo ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {pending ? 'Procesando…' : rechazo ? 'Sí, rechazar' : 'Sí, aprobar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Una solicitud pendiente con sus tres acciones. */
function PendingRequestRow({
  request,
  onDetail,
  onApprove,
  onReject,
  disabled,
}: {
  request: VacationRequestItem;
  onDetail: () => void;
  onApprove: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy">
          Del {formatDate(request.startDate)} al {formatDate(request.endDate)} ·{' '}
          {request.workingDaysTaken} {request.workingDaysTaken === 1 ? 'día' : 'días'}
        </p>
        <p className="font-mono text-xs text-slate-400">{request.displayId}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDetail}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          Ver detalle
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
        >
          <CheckIcon className="h-3.5 w-3.5" />
          Aprobar
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          <CloseIcon className="h-3.5 w-3.5" />
          Rechazar
        </button>
      </div>
    </div>
  );
}

/** Historial del período, plegado por defecto para no alargar cada card. */
function HistorySection({
  requests,
  onDetail,
}: {
  requests: VacationRequestItem[];
  onDetail: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  if (requests.length === 0) return null;

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="text-xs font-semibold text-slate-500 transition hover:text-navy"
      >
        {abierto ? 'Ocultar historial' : `Ver historial del período (${requests.length})`}
      </button>

      {abierto && (
        <ul className="mt-3 space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2"
            >
              <span className="text-sm text-slate-700">
                {formatDate(r.startDate)} – {formatDate(r.endDate)} · {r.workingDaysTaken}{' '}
                {r.workingDaysTaken === 1 ? 'día' : 'días'}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[r.status].className}`}
                >
                  {STATUS_META[r.status].label}
                </span>
                <button
                  type="button"
                  onClick={() => onDetail(r.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <EyeIcon className="h-3 w-3" />
                  Detalle
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  team: TeamVacationRow[];
  errorKind: ErrorKind | null;
}

export function TeamVacationsScreen({ team, errorKind }: Props) {
  const router = useRouter();
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [decision, setDecision] = useState<
    { request: VacationRequestItem; employeeName: string; kind: 'approve' | 'reject' } | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Mismo criterio que la pantalla de "Mis vacaciones": no hay toasts en el
  // proyecto y un aviso fijo se acumula tras varias decisiones.
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(t);
  }, [feedback]);

  function runDecision(note: string) {
    if (!decision) return;
    const { request, kind } = decision;
    setActionError(null);

    startTransition(async () => {
      const res =
        kind === 'approve'
          ? await approveTeamVacationAction(request.id, note)
          : await rejectTeamVacationAction(request.id, note);

      if (res.success) {
        setDecision(null);
        setFeedback(
          kind === 'approve'
            ? `Solicitud ${request.displayId} aprobada.`
            : `Solicitud ${request.displayId} rechazada. Los días volvieron al saldo.`,
        );
        router.refresh();
      } else {
        setActionError(res.error ?? 'No se pudo registrar la decisión.');
      }
    });
  }

  if (errorKind === 'forbidden') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">No tienes permiso para ver esta pantalla.</p>
      </div>
    );
  }

  if (errorKind === 'unavailable') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-navy">Servicio no disponible</p>
        <p className="mt-1 text-sm text-slate-500">
          No pudimos cargar la información de tu equipo. Intenta de nuevo en unos minutos.
        </p>
      </div>
    );
  }

  const totalPendientes = team.reduce((n, row) => n + row.pendingRequests.length, 0);
  // El promedio solo cuenta a quien ya tiene balance: incluir a los de menos de
  // un año como cero lo hundiría sin que signifique nada.
  const conBalance = team.filter((row) => row.balance !== null);
  const promedioDisponibles =
    conBalance.length > 0
      ? (
          conBalance.reduce((n, row) => n + (row.balance?.availableDays ?? 0), 0) / conBalance.length
        ).toFixed(1)
      : '—';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-black">
          <UsersGroupIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
          <h1 className="text-2xl font-bold text-navy">Gestión de Vacaciones de mi Equipo</h1>
        </div>
      </header>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Colaboradores" value={String(team.length)} hint="a tu cargo" />
        <StatCard
          label="Solicitudes pendientes"
          value={String(totalPendientes)}
          hint={totalPendientes === 0 ? 'nada por resolver' : 'esperan tu respuesta'}
        />
        <StatCard
          label="Días disponibles promedio"
          value={promedioDisponibles}
          hint={
            conBalance.length === team.length
              ? 'del período vigente'
              : `sobre ${conBalance.length} con período vigente`
          }
        />
      </div>

      {team.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <PlaneIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-navy">No tienes colaboradores a cargo</p>
          <p className="mt-1 text-sm text-slate-500">
            Esta pantalla lista a quienes te reportan directamente. Si crees que falta alguien,
            contacta a Recursos Humanos.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {team.map((row) => (
            <article
              key={row.employee.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center gap-3 px-4 py-4">
                <Avatar row={row} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{row.employee.fullName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[
                      row.employee.area,
                      row.employee.position,
                      row.employee.yearsOfService !== null
                        ? `${row.employee.yearsOfService} ${row.employee.yearsOfService === 1 ? 'año' : 'años'} de servicio`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm">
                {row.balance ? (
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span className="text-slate-500">
                      Disponibles:{' '}
                      <span className="font-semibold text-navy">{row.balance.availableDays}</span>
                    </span>
                    <span className="text-slate-500">
                      Usados: <span className="font-semibold text-navy">{row.balance.usedDays}</span>
                    </span>
                    <span className="text-slate-500">
                      Con derecho:{' '}
                      <span className="font-semibold text-navy">{row.balance.entitledDays}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      Período {formatDate(row.balance.periodStart)} — {formatDate(row.balance.periodEnd)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    Sin período vigente (aún no cumple su primer año o falta su fecha de antigüedad).
                  </span>
                )}
              </div>

              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Solicitudes pendientes
                </p>
                {row.pendingRequests.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin solicitudes pendientes</p>
                ) : (
                  <div className="space-y-2">
                    {row.pendingRequests.map((r) => (
                      <PendingRequestRow
                        key={r.id}
                        request={r}
                        disabled={isPending}
                        onDetail={() => setDetalleId(r.id)}
                        onApprove={() => {
                          setActionError(null);
                          setDecision({
                            request: r,
                            employeeName: row.employee.fullName,
                            kind: 'approve',
                          });
                        }}
                        onReject={() => {
                          setActionError(null);
                          setDecision({
                            request: r,
                            employeeName: row.employee.fullName,
                            kind: 'reject',
                          });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <HistorySection requests={row.allRequests} onDetail={setDetalleId} />
            </article>
          ))}
        </div>
      )}

      {detalleId && (
        <VacationRequestDetailModal
          requestId={detalleId}
          showEmployee
          onClose={() => setDetalleId(null)}
        />
      )}

      {decision && (
        <DecisionDialog
          // Remonta el formulario al cambiar de solicitud para que la nota
          // escrita para una no reaparezca en la siguiente.
          key={`${decision.request.id}-${decision.kind}`}
          request={decision.request}
          employeeName={decision.employeeName}
          kind={decision.kind}
          pending={isPending}
          error={actionError}
          onConfirm={runDecision}
          onCancel={() => {
            setDecision(null);
            setActionError(null);
          }}
        />
      )}
    </div>
  );
}
