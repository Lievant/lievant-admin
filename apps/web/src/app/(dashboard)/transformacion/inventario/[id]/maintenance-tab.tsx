'use client';

import { useEffect, useState } from 'react';
import { ScrollableTable } from '@/components/ui/scrollable-table';
import type {
  MaintenanceListResponse,
  MaintenanceType,
  TechnicianOption,
} from '@/lib/api';
import { formatDate } from '../constants';

/** Resumen derivado que el encabezado del detalle necesita para su badge. */
export interface MaintenanceSummary {
  maintenanceStatus: MaintenanceListResponse['maintenanceStatus'];
  nextMaintenanceDate: string | null;
  lastMaintenanceDate: string | null;
}

interface MaintenanceTabProps {
  equipmentId: string;
  canWrite: boolean;
  onSummaryChange?: (summary: MaintenanceSummary) => void;
}

const TYPE_STYLE: Record<MaintenanceType, string> = {
  Preventivo: 'bg-blue-50 text-blue-700',
  Correctivo: 'bg-orange-50 text-orange-700',
};

/** 'YYYY-MM-DD' de hoy en local, para topar el datepicker (RN-3, no futura). */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function MaintenanceTab({ equipmentId, canWrite, onSummaryChange }: MaintenanceTabProps) {
  const [data, setData] = useState<MaintenanceListResponse | null | undefined>(undefined);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    maintenanceDate: todayLocal(),
    maintenanceType: 'Preventivo' as MaintenanceType,
    technicianId: '',
    observations: '',
  });

  function applyResponse(res: MaintenanceListResponse) {
    setData(res);
    onSummaryChange?.({
      maintenanceStatus: res.maintenanceStatus,
      nextMaintenanceDate: res.nextMaintenanceDate,
      lastMaintenanceDate: res.lastMaintenanceDate,
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/inventory/equipment/${equipmentId}/maintenance`)
      .then((res) => (res.ok ? (res.json() as Promise<MaintenanceListResponse>) : null))
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

  // El catálogo de técnicos solo se carga cuando hace falta (al abrir el diálogo).
  useEffect(() => {
    if (!dialogOpen || technicians.length > 0) return;
    let cancelled = false;
    fetch('/api/catalogs/ticket_assignees/active')
      .then((res) => (res.ok ? (res.json() as Promise<TechnicianOption[]>) : []))
      .then((list) => {
        if (!cancelled) setTechnicians(list);
      })
      .catch(() => {
        if (!cancelled) setTechnicians([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, technicians.length]);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/equipment/${equipmentId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceDate: form.maintenanceDate,
          maintenanceType: form.maintenanceType,
          technicianId: form.technicianId,
          observations: form.observations || undefined,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
        const msg = Array.isArray(detail?.message) ? detail?.message.join(', ') : detail?.message;
        throw new Error(msg ?? 'No se pudo registrar el mantenimiento.');
      }
      applyResponse((await res.json()) as MaintenanceListResponse);
      setDialogOpen(false);
      setForm({
        maintenanceDate: todayLocal(),
        maintenanceType: 'Preventivo',
        technicianId: '',
        observations: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el mantenimiento.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este mantenimiento? Se conservará en la base como registro histórico.')) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/equipment/${equipmentId}/maintenance/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('No se pudo eliminar el mantenimiento.');
      applyResponse((await res.json()) as MaintenanceListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el mantenimiento.');
    } finally {
      setDeletingId(null);
    }
  }

  if (data === undefined) {
    return <p className="px-1 py-6 text-sm text-slate-400">Cargando mantenimientos…</p>;
  }
  if (data === null) {
    return <p className="px-1 py-6 text-sm text-slate-400">No se pudieron cargar los mantenimientos.</p>;
  }

  const { data: records } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          Último preventivo:{' '}
          <span className="font-medium text-navy">{formatDate(data.lastMaintenanceDate)}</span>
          <span className="mx-2 text-slate-300">·</span>
          Próximo:{' '}
          <span className="font-medium text-navy">{formatDate(data.nextMaintenanceDate)}</span>
        </div>
        {canWrite && (
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Registrar mantenimiento
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-sm text-slate-500">Este equipo no tiene mantenimientos registrados.</p>
        </div>
      ) : (
        <ScrollableTable>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Observaciones</th>
                {canWrite && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.maintenanceDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        TYPE_STYLE[r.maintenanceType] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.maintenanceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy">{r.technicianName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.observations ?? '—'}</td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === r.id ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}

      {/* Diálogo de registro */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-navy">Registrar mantenimiento</h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fecha *
                </label>
                <input
                  type="date"
                  max={todayLocal()}
                  value={form.maintenanceDate}
                  onChange={(e) => set('maintenanceDate', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tipo *
                </label>
                <select
                  value={form.maintenanceType}
                  onChange={(e) => set('maintenanceType', e.target.value as MaintenanceType)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                >
                  <option value="Preventivo">Preventivo</option>
                  <option value="Correctivo">Correctivo</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  Solo el preventivo reinicia el conteo de 6 meses.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Técnico *
                </label>
                <select
                  value={form.technicianId}
                  onChange={(e) => set('technicianId', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                >
                  <option value="">Selecciona un técnico…</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Observaciones
                </label>
                <textarea
                  value={form.observations}
                  onChange={(e) => set('observations', e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDialogOpen(false);
                  setError(null);
                }}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting || !form.maintenanceDate || !form.technicianId}
                className="rounded-md bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
