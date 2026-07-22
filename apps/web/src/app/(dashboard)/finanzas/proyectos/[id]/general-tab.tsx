'use client';

import { useState } from 'react';
import type { ProjectDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

const BUSINESS_UNITS = [
  { value: 'marketing_digital', label: 'Marketing Digital' },
  { value: 'marketplaces', label: 'Marketplaces' },
  { value: 'performance', label: 'Performance' },
  { value: 'fullcommerce', label: 'Fullcommerce' },
  { value: 'omnicanalidad', label: 'Omnicanalidad' },
];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-amber-100 text-amber-800',
  closed: 'bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
};

const TYPE_LABELS: Record<string, string> = {
  recurring: 'Recurrente',
  one_time: 'One-time',
};

interface Props {
  project: ProjectDetail;
  onUpdate: (p: ProjectDetail) => void;
}

export function GeneralTab({ project, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? '',
    status: project.status,
    projectType: project.projectType,
    primaryBusinessUnit: project.primaryBusinessUnit ?? '',
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    pmCode: project.pmCode ?? '',
  });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          status: form.status,
          projectType: form.projectType,
          primaryBusinessUnit: form.primaryBusinessUnit || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          pmCode: form.pmCode || null,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const updated = await res.json() as ProjectDetail;
      onUpdate({ ...project, ...updated });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function Field({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {children ?? <p className="text-sm text-navy">{value ?? '—'}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-navy">Datos generales</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-terracota px-3 py-1.5 text-sm font-medium text-white hover:bg-terracota/90 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!editing ? (
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          <Field label="ID" value={project.displayId} />
          <Field label="Nombre" value={project.name} />
          <Field label="Estado">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[project.status] ?? 'bg-slate-100 text-slate-600')}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </Field>
          <Field label="Tipo" value={TYPE_LABELS[project.projectType] ?? project.projectType} />
          <Field label="Área principal" value={project.primaryBusinessUnit} />
          <Field label="Cliente" value={project.clientName} />
          <Field label="Project Manager" value={project.projectManagerName} />
          <Field label="Fecha inicio" value={project.startDate} />
          <Field label="Fecha fin" value={project.endDate} />
          <Field label="Código Cor" value={project.pmCode} />
          <Field label="Cor sync" value={project.corSyncStatus} />
          <div className="col-span-2 lg:col-span-3">
            <Field label="Descripción" value={project.description} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="active">Activo</option>
              <option value="paused">Pausado</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
            <select
              value={form.projectType}
              onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="recurring">Recurrente</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Área principal</label>
            <select
              value={form.primaryBusinessUnit}
              onChange={(e) => setForm((f) => ({ ...f, primaryBusinessUnit: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">— Sin área —</option>
              {BUSINESS_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fecha inicio</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fecha fin</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Código Cor</label>
            <input
              value={form.pmCode}
              onChange={(e) => setForm((f) => ({ ...f, pmCode: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="col-span-2 lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-600">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
            />
          </div>
        </div>
      )}

      {/* History */}
      {project.history.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Historial reciente</h3>
          <ul className="space-y-2">
            {project.history.slice(0, 5).map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">{h.action}</span>
                <span className="text-slate-600">{h.notes ?? h.newValue}</span>
                <span className="ml-auto shrink-0 text-xs text-slate-400">{new Date(h.createdAt).toLocaleDateString('es-MX')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
