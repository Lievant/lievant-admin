'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EmployeeVacationSummary,
  VacationMovementItem,
  VacationRequestItem,
  VacationRequestStatus,
} from '@/lib/api';
import { usePermission } from '@/hooks/use-permission';
import { PlusIcon } from '@/components/icons';
import { AdminVacationRequestDialog } from './admin-vacation-request-dialog';
import {
  adminApproveVacationRequestAction,
  adminDeleteVacationRequestAction,
} from './actions';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

function currency(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

const MOVEMENT_META: Record<VacationMovementItem['movementType'], { label: string; color: string }> = {
  PERIOD_START: { label: 'Inicio de período', color: 'bg-emerald-500' },
  PERIOD_EXPIRY: { label: 'Expiración', color: 'bg-rose-500' },
  REQUEST_APPROVED: { label: 'Solicitud aprobada', color: 'bg-sky-500' },
  REQUEST_CANCELLED: { label: 'Devolución / rechazo', color: 'bg-amber-500' },
  ADMIN_CANCELLED: { label: 'Cancelación por RRHH', color: 'bg-orange-500' },
  MANUAL_ADJUSTMENT: { label: 'Ajuste manual', color: 'bg-slate-500' },
};

const STATUS_META: Record<VacationRequestStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', className: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelada', className: 'bg-slate-100 text-slate-600' },
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-navy">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Confirmación en línea para no depender de window.confirm. */
function ConfirmBar({
  message,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
      <span className="mr-auto text-xs text-amber-800">{message}</span>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
      >
        No
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className={`rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-60 ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-black hover:bg-zinc-800'
        }`}
      >
        {pending ? 'Procesando…' : confirmLabel}
      </button>
    </div>
  );
}

export function VacationTab({
  summary,
  canView,
}: {
  summary: EmployeeVacationSummary | null;
  canView: boolean;
}) {
  const router = useRouter();
  const canManage = usePermission('rrhh', 'vacaciones', 'manage');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [confirming, setConfirming] = useState<{ id: string; kind: 'approve' | 'delete' } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runApprove(requestId: string) {
    if (!summary) return;
    setActionError(null);
    startTransition(async () => {
      const res = await adminApproveVacationRequestAction(summary.employeeId, requestId);
      if (res.success) {
        setConfirming(null);
        router.refresh();
      } else {
        setActionError(res.error ?? 'No se pudo aprobar la solicitud.');
      }
    });
  }

  function runDelete(requestId: string) {
    if (!summary) return;
    setActionError(null);
    startTransition(async () => {
      const res = await adminDeleteVacationRequestAction(summary.employeeId, requestId);
      if (res.success) {
        setConfirming(null);
        router.refresh();
      } else {
        setActionError(res.error ?? 'No se pudo eliminar la solicitud.');
      }
    });
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">
          Necesitas el permiso <span className="font-mono">rrhh.empleados.vacaciones</span> para ver esta
          información.
        </p>
      </div>
    );
  }

  if (!summary || !summary.balance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
        Este empleado no tiene un período de vacaciones vigente (¿falta la fecha de antigüedad?).
      </div>
    );
  }

  const b = summary.balance;

  return (
    <div className="space-y-6">
      {/* Saldo actual */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Disponibles" value={String(b.availableDays)} hint={`de ${b.entitledDays}`} />
        <StatCard label="Con derecho" value={String(b.entitledDays)} />
        <StatCard label="Usados" value={String(b.usedDays)} />
        <StatCard label="Expirados" value={String(b.expiredDays)} />
        <StatCard label="Antigüedad" value={`${b.yearsOfService} año${b.yearsOfService === 1 ? '' : 's'}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período actual</p>
          <p className="mt-1 text-sm font-medium text-navy">
            {formatDate(b.periodStart)} — {formatDate(b.periodEnd)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prima vacacional estimada</p>
          <p className="mt-1 text-sm font-medium text-navy">
            {currency(summary.compensation.estimatedPrima)}
            <span className="ml-2 text-xs font-normal text-slate-400">
              (salario diario {currency(summary.compensation.dailySalary)} · 25% sobre {b.entitledDays} días)
            </span>
          </p>
        </div>
      </div>

      {/* Timeline de movimientos */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Historial de movimientos</h3>
        {summary.movements.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Sin movimientos registrados.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {summary.movements.map((m) => {
              const meta = MOVEMENT_META[m.movementType];
              return (
                <li key={m.id} className="relative">
                  <span className={`absolute -left-[1.42rem] top-1 h-3 w-3 rounded-full ${meta.color}`} />
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{meta.label}</p>
                    <span className={`text-sm font-semibold ${m.daysDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.daysDelta >= 0 ? '+' : ''}
                      {m.daysDelta} días
                    </span>
                  </div>
                  {m.description && <p className="text-xs text-slate-500">{m.description}</p>}
                  <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString('es-MX')}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Historial de solicitudes */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Solicitudes</h3>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Nueva solicitud
            </button>
          )}
        </div>

        {actionError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {actionError}
          </div>
        )}

        {summary.requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Sin solicitudes registradas.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Folio</th>
                  <th className="px-4 py-3 text-left">Fechas</th>
                  <th className="px-4 py-3 text-left">Días</th>
                  <th className="px-4 py-3 text-left">Sustituto</th>
                  <th className="px-4 py-3 text-left">Origen</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.displayId}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-navy">{r.workingDaysTaken}</td>
                    <td className="px-4 py-3 text-slate-600">{r.substitute?.fullName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.createdByAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r.createdByAdmin ? 'Administrador' : 'Colaborador'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[r.status].className}`}>
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right align-top">
                        <RequestActions
                          request={r}
                          confirming={confirming}
                          pending={isPending}
                          onAsk={setConfirming}
                          onApprove={runApprove}
                          onDelete={runDelete}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNewDialog && (
        <AdminVacationRequestDialog
          employeeId={summary.employeeId}
          employeeName={summary.fullName}
          availableDays={b.availableDays}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}

/**
 * Acciones por solicitud. Pendiente: aprobar o eliminar. Aprobada: eliminar,
 * que devuelve los días al saldo. Rechazada o cancelada: nada, porque los días
 * ya se reintegraron y borrarlas no aportaría.
 */
function RequestActions({
  request,
  confirming,
  pending,
  onAsk,
  onApprove,
  onDelete,
}: {
  request: VacationRequestItem;
  confirming: { id: string; kind: 'approve' | 'delete' } | null;
  pending: boolean;
  onAsk: (v: { id: string; kind: 'approve' | 'delete' } | null) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const activo = confirming?.id === request.id ? confirming.kind : null;

  if (activo === 'approve') {
    return (
      <ConfirmBar
        message={`¿Aprobar ${request.displayId} por ${request.workingDaysTaken} días?`}
        confirmLabel="Sí, aprobar"
        pending={pending}
        onConfirm={() => onApprove(request.id)}
        onCancel={() => onAsk(null)}
      />
    );
  }

  if (activo === 'delete') {
    return (
      <ConfirmBar
        message={
          request.status === 'approved'
            ? `¿Seguro? Esto revertirá ${request.workingDaysTaken} días al balance del empleado.`
            : `¿Eliminar ${request.displayId}? Se devolverán ${request.workingDaysTaken} días al saldo.`
        }
        confirmLabel="Sí, eliminar"
        danger
        pending={pending}
        onConfirm={() => onDelete(request.id)}
        onCancel={() => onAsk(null)}
      />
    );
  }

  if (request.status !== 'pending' && request.status !== 'approved') {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex justify-end gap-2">
      {request.status === 'pending' && (
        <button
          type="button"
          onClick={() => onAsk({ id: request.id, kind: 'approve' })}
          className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:border-emerald-300"
        >
          Aprobar
        </button>
      )}
      <button
        type="button"
        onClick={() => onAsk({ id: request.id, kind: 'delete' })}
        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:border-red-300"
      >
        Eliminar
      </button>
    </div>
  );
}
