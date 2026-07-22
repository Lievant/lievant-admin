'use client';

import type {
  EmployeeVacationSummary,
  VacationMovementItem,
  VacationRequestStatus,
} from '@/lib/api';

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

export function VacationTab({
  summary,
  canView,
}: {
  summary: EmployeeVacationSummary | null;
  canView: boolean;
}) {
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
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Solicitudes</h3>
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
                  <th className="px-4 py-3 text-left">Estado</th>
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
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_META[r.status].className}`}>
                        {STATUS_META[r.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
