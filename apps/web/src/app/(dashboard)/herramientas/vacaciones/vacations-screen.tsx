'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { ErrorKind, MyVacationBalance, VacationRequestItem, VacationRequestStatus } from '@/lib/api';
import { PlaneIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { usePermission } from '@/hooks/use-permission';
import { deleteVacationRequestAction } from './actions';

interface Props {
  balance: MyVacationBalance | null;
  requests: VacationRequestItem[];
  errorKind: ErrorKind | null;
}

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function formatDate(iso: string): string {
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

function StatusBadge({ status }: { status: VacationRequestStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

/**
 * Confirmación a pantalla completa. Se usa modal y no la barra inline del tab
 * de RRHH porque aquí el aviso tiene que explicar tres consecuencias (días,
 * notificaciones e irreversibilidad) y no cabe dentro de la fila.
 */
function CancelDialog({
  request,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  request: VacationRequestItem;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancelar-solicitud-titulo"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 id="cancelar-solicitud-titulo" className="text-base font-semibold text-navy">
          ¿Cancelar esta solicitud de vacaciones?
        </h3>
        <p className="mt-3 text-sm text-slate-600">
          Del <span className="font-medium text-navy">{formatDate(request.startDate)}</span> al{' '}
          <span className="font-medium text-navy">{formatDate(request.endDate)}</span> (
          {request.workingDaysTaken} días).
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Los días serán devueltos a tu balance disponible. Las notificaciones relacionadas también
          serán eliminadas.
        </p>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            No, mantener
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Cancelando…' : 'Sí, cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VacationsScreen({ balance, requests, errorKind }: Props) {
  // Los hooks van antes de los returns tempranos de abajo (reglas de hooks).
  const router = useRouter();
  const canManage = usePermission('rrhh', 'vacaciones', 'manage');
  const [confirming, setConfirming] = useState<VacationRequestItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // El aviso de éxito se va solo: no hay sistema de toasts en el proyecto y
  // dejarlo fijo ensucia la pantalla tras varias cancelaciones.
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(t);
  }, [feedback]);

  function runDelete(request: VacationRequestItem) {
    setActionError(null);
    startTransition(async () => {
      const res = await deleteVacationRequestAction(request.id);
      if (res.success) {
        setConfirming(null);
        setFeedback('Solicitud cancelada. Días devueltos a tu balance.');
        router.refresh();
      } else {
        setActionError(res.error ?? 'No se pudo cancelar la solicitud.');
      }
    });
  }

  /** Aprobadas: solo RRHH. Rechazadas y canceladas ya no se tocan desde aquí. */
  function puedeCancelar(request: VacationRequestItem): boolean {
    if (request.status === 'pending') return true;
    if (request.status === 'approved') return canManage;
    return false;
  }

  if (errorKind === 'forbidden') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Acceso restringido</p>
        <p className="mt-1 text-sm text-amber-600">No tienes permiso para ver el módulo de vacaciones.</p>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <PlaneIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-semibold text-navy">Sin expediente de empleado</p>
        <p className="mt-1 text-sm text-slate-500">
          No encontramos un expediente vinculado a tu usuario. Contacta a Recursos Humanos.
        </p>
      </div>
    );
  }

  const b = balance.balance;

  // Empleado con menos de 1 año de servicio: aún no tiene balance de vacaciones.
  if (!b) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-black">
            <PlaneIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
            <h1 className="text-2xl font-bold text-navy">Mis vacaciones</h1>
          </div>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <PlaneIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-navy">
            Aún no has completado tu primer año de servicio.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {balance.firstAnniversary
              ? `Tus vacaciones comenzarán el ${formatDate(balance.firstAnniversary)}.`
              : 'Tus vacaciones comenzarán al cumplir tu primer aniversario.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-black">
            <PlaneIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
            <h1 className="text-2xl font-bold text-navy">Mis vacaciones</h1>
          </div>
        </div>
        <Link
          href="/herramientas/vacaciones/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          <PlusIcon className="h-4 w-4" />
          Solicitar vacaciones
        </Link>
      </header>

      {feedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Días disponibles" value={String(b.availableDays)} hint={`de ${b.entitledDays} del período`} />
        <StatCard label="Días usados" value={String(b.usedDays)} hint="este período" />
        <StatCard
          label="Período actual"
          value={`${formatDate(b.periodStart)}`}
          hint={`al ${formatDate(b.periodEnd)}`}
        />
        <StatCard label="Antigüedad" value={`${b.yearsOfService} año${b.yearsOfService === 1 ? '' : 's'}`} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Mis solicitudes</h2>
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
            Aún no has solicitado vacaciones.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <ScrollableTable>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">Folio</th>
                  <th className="px-4 py-3 text-left">Fechas</th>
                  <th className="px-4 py-3 text-left">Días hábiles</th>
                  <th className="px-4 py-3 text-left">Sustituto</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.displayId}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(r.startDate)} – {formatDate(r.endDate)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-navy">{r.workingDaysTaken}</td>
                    <td className="px-4 py-3 text-slate-600">{r.substitute?.fullName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status === 'rejected' && r.rejectionReason && (
                        <p className="mt-1 text-xs text-rose-500">{r.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {puedeCancelar(r) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setConfirming(r);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:border-red-300 hover:bg-red-50"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Cancelar solicitud
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </ScrollableTable>
          </div>
        )}
      </section>

      {confirming && (
        <CancelDialog
          request={confirming}
          pending={isPending}
          error={actionError}
          onConfirm={() => runDelete(confirming)}
          onCancel={() => {
            setConfirming(null);
            setActionError(null);
          }}
        />
      )}
    </div>
  );
}
