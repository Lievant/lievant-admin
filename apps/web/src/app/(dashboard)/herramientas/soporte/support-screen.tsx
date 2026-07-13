'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ErrorKind, TicketPage, TicketPriority, TicketStatus, TicketSummary } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { PlusIcon } from '@/components/icons';

const SLA_HOURS: Record<TicketPriority, number> = { P1: 4, P2: 8, P3: 24, P4: 72 };

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-emerald-100 text-emerald-700',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  abierto: 'bg-amber-100 text-amber-700',
  en_atencion: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

function slaLight(ticket: TicketSummary): 'verde' | 'amarillo' | 'rojo' | null {
  if (!ticket.priority || ticket.status === 'cerrado' || ticket.status === 'cancelado') return null;
  const limit = SLA_HOURS[ticket.priority];
  if (!limit) return null;
  const elapsed = (Date.now() - new Date(ticket.requestedAt).getTime()) / 3_600_000;
  const pct = elapsed / limit;
  if (pct >= 1) return 'rojo';
  if (pct >= 0.75) return 'amarillo';
  return 'verde';
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'abierto', label: 'Abiertos' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'resuelto', label: 'Resueltos' },
  { value: 'cerrado', label: 'Cerrados' },
];

interface SupportScreenProps {
  page: TicketPage;
  errorKind: ErrorKind | null;
  statusFilter: string;
}

export function SupportScreen({ page, errorKind, statusFilter }: SupportScreenProps) {
  const router = useRouter();

  function onStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    const sp = new URLSearchParams();
    if (val) sp.set('status', val);
    router.push(`/herramientas/soporte${sp.toString() ? `?${sp.toString()}` : ''}`);
  }

  const tickets = page.data;

  if (errorKind === 'forbidden') {
    return <NoPermissions />;
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-terracota">Herramientas</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">Mis tickets de soporte TI</h1>
        </div>
        <Link
          href="/herramientas/soporte/nuevo"
          className="flex items-center gap-2 rounded-lg bg-terracota px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-terracota/90"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo ticket
        </Link>
      </header>

      {errorKind === 'unavailable' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo conectar con el servidor. Intenta de nuevo más tarde.
        </div>
      )}

      {/* Filtro de estado */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Estado:</label>
        <select
          value={statusFilter}
          onChange={onStatusChange}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-terracota focus:outline-none"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 14v-3a8 8 0 1 1 16 0v3" />
              <rect x="2" y="13" width="4" height="7" rx="1" />
              <rect x="18" y="13" width="4" height="7" rx="1" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">
            {statusFilter
              ? 'No tienes tickets con ese estado.'
              : 'Aún no tienes tickets de soporte.'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {!statusFilter &&
              'Si tienes algún problema técnico, créalo aquí y el equipo de TI lo atenderá a la brevedad.'}
          </p>
          {!statusFilter && (
            <Link
              href="/herramientas/soporte/nuevo"
              className="mt-4 flex items-center gap-2 rounded-lg bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota/90"
            >
              <PlusIcon className="h-4 w-4" />
              Crear primer ticket
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ScrollableTable>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Prioridad</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">SLA</th>
                <th className="px-4 py-3 text-left">Apertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => {
                const sla = slaLight(t);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.displayId}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{t.category ?? '—'}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">
                      <span title={t.description}>
                        {t.description.length > 60
                          ? `${t.description.slice(0, 60)}…`
                          : t.description}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.priority ? (
                        <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', PRIORITY_STYLES[t.priority])}>
                          {t.priority}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_STYLES[t.status])}>
                        {STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {sla === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={cn('inline-block h-3 w-3 rounded-full', {
                            'bg-emerald-500': sla === 'verde',
                            'bg-amber-400': sla === 'amarillo',
                            'bg-red-500': sla === 'rojo',
                          })}
                          title={sla === 'verde' ? 'En tiempo' : sla === 'amarillo' ? 'Próximo a vencer' : 'Vencido'}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(t.requestedAt).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </ScrollableTable>
        </div>
      )}
    </>
  );
}
