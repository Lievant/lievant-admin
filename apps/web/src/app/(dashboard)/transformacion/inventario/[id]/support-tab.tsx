'use client';

import { useEffect, useState } from 'react';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type { EquipmentTicketsResponse } from '@/lib/api';

interface SupportTabProps {
  equipmentId: string;
}

// Mismos colores que la pantalla de tickets, para que un P1 se vea igual en los
// dos lugares. P4 va en gris según el diseño pedido para esta tabla.
const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-yellow-100 text-yellow-800',
  P4: 'bg-slate-100 text-slate-600',
};

const STATUS_STYLES: Record<string, string> = {
  abierto: 'bg-amber-100 text-amber-700',
  en_atencion: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-indigo-100 text-indigo-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_atencion: 'En atención',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function SupportTab({ equipmentId }: SupportTabProps) {
  const [data, setData] = useState<EquipmentTicketsResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inventory/equipment/${equipmentId}/tickets`)
      .then((res) => (res.ok ? (res.json() as Promise<EquipmentTicketsResponse>) : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  if (data === undefined) {
    return <p className="px-1 py-6 text-sm text-slate-400">Cargando tickets…</p>;
  }
  if (data === null) {
    return <p className="px-1 py-6 text-sm text-slate-400">No se pudieron cargar los tickets.</p>;
  }

  const { tickets, legacyId, displayId } = data;

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
        <p className="text-sm text-slate-500">
          No hay tickets de soporte asociados a este equipo.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {/* El vínculo es por el ID de la etiqueta, que es lo que la gente
              escribe al levantar el ticket. */}
          Se buscaron tickets con el ID{' '}
          <span className="font-mono text-slate-600">{legacyId ?? displayId}</span>
          {legacyId && (
            <>
              {' '}
              o <span className="font-mono text-slate-600">{displayId}</span>
            </>
          )}
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-navy">
        {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} de soporte{' '}
        {tickets.length === 1 ? 'asociado' : 'asociados'}
        <span className="ml-2 text-xs font-normal text-slate-400">
          vinculados por el ID{' '}
          <span className="font-mono">{legacyId ?? displayId}</span>
        </span>
      </p>

      <ScrollableTable>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Subcategoría</th>
              <th className="px-4 py-3">Prioridad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Asignado a</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr
                key={t.id}
                onClick={() => window.open(`/transformacion/tickets/${t.id}`, '_blank')}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.ticketCode}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{t.title}</p>
                  <p className="line-clamp-1 text-xs text-slate-400">{t.description}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{t.category}</td>
                <td className="px-4 py-3 text-slate-600">{t.subcategory ?? '—'}</td>
                <td className="px-4 py-3">
                  {t.priority ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        PRIORITY_STYLES[t.priority] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.priority}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      STATUS_STYLES[t.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(t.createdAt)}</td>
                <td className="px-4 py-3 text-slate-600">{t.assignee?.fullName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableTable>
    </div>
  );
}
