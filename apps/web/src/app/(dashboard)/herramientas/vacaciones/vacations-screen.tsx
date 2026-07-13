'use client';

import Link from 'next/link';
import type { ErrorKind, MyVacationBalance, VacationRequestItem, VacationRequestStatus } from '@/lib/api';
import { PlaneIcon, PlusIcon } from '@/components/icons';
import { ScrollableTable } from '@/components/ui/scrollable-table';

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

export function VacationsScreen({ balance, requests, errorKind }: Props) {
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracota-bg text-terracota">
            <PlaneIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-terracota">Herramientas</p>
            <h1 className="text-2xl font-bold text-navy">Mis vacaciones</h1>
          </div>
        </div>
        <Link
          href="/herramientas/vacaciones/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white transition hover:bg-terracota-dark"
        >
          <PlusIcon className="h-4 w-4" />
          Solicitar vacaciones
        </Link>
      </header>

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
                  </tr>
                ))}
              </tbody>
            </table>
            </ScrollableTable>
          </div>
        )}
      </section>
    </div>
  );
}
