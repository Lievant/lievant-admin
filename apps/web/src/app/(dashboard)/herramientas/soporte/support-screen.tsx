'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ErrorKind, TicketPage } from '@/lib/api';
import { NoPermissions } from '@/components/ui/no-permissions';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import { PlusIcon } from '@/components/icons';
import { TicketDetailModal } from './ticket-detail-modal';
import { PRIORITY_STYLES, SLA_TONE_STYLES, STATUS_LABELS, STATUS_STYLES, formatDate } from './ticket-display';
import { attentionTime, slaStatus } from './ticket-sla';

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
  const searchParams = useSearchParams();
  // ?ticket=<id> (el enlace de las notificaciones) abre el detalle al entrar.
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = searchParams.get('ticket');
    if (fromUrl) setOpenTicketId(fromUrl);
  }, [searchParams]);

  function closeDetail() {
    setOpenTicketId(null);
    if (searchParams.get('ticket')) {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete('ticket');
      router.replace(`/herramientas/soporte${sp.toString() ? `?${sp.toString()}` : ''}`);
    }
  }

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
          <p className="text-sm font-medium uppercase tracking-wide text-black">Herramientas</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">Mis tickets de soporte TI</h1>
        </div>
        <Link
          href="/herramientas/soporte/nuevo"
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800"
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
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-black focus:outline-none"
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
              className="mt-4 flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
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
                <th className="px-4 py-3 text-left">Cierre</th>
                <th className="px-4 py-3 text-left">Tiempo de atención</th>
                <th className="px-4 py-3 text-right"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t) => {
                const sla = slaStatus({ ...t, slaResolutionHours: t.slaResolutionHours ?? null });
                const attention = attentionTime(t);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.displayId}</td>
                    <td className="px-4 py-3 text-slate-700">{t.categoryName ?? t.category ?? '—'}</td>
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
                    <td className="whitespace-nowrap px-4 py-3">
                      {sla.tone === 'none' ? (
                        <span className="text-slate-400">{sla.label}</span>
                      ) : (
                        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', SLA_TONE_STYLES[sla.tone])}>
                          {sla.label}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(t.requestedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{t.closedAt ? formatDate(t.closedAt) : ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{attention ?? ''}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenTicketId(t.id)}
                        className="whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </ScrollableTable>
        </div>
      )}

      {openTicketId && <TicketDetailModal ticketId={openTicketId} onClose={closeDetail} />}
    </>
  );
}
