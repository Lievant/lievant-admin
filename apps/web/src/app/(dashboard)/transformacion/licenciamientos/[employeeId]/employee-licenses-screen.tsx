'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { avatarColor, initials } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import type { EmployeeLicenseDetail, ToolCatalogItem } from '@/lib/api';

interface Props {
  detail: EmployeeLicenseDetail;
  tools: ToolCatalogItem[];
}

interface ToolState {
  hasAccess: boolean;
  isAdmin: boolean;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-black' : 'bg-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

export function EmployeeLicensesScreen({ detail: initialDetail, tools }: Props) {
  const [detail, setDetail] = useState(initialDetail);
  const [activeDirectoryName, setActiveDirectoryName] = useState(detail.activeDirectoryName ?? '');
  const [responsiva, setResponsiva] = useState(detail.responsiva ?? '');
  const [toolStates, setToolStates] = useState<Record<string, ToolState>>(() => {
    const initial: Record<string, ToolState> = {};
    for (const t of tools) {
      const current = detail.tools.find((dt) => dt.toolId === t.id);
      initial[t.id] = { hasAccess: current?.hasAccess ?? false, isAdmin: current?.isAdmin ?? false };
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [imgFailed, setImgFailed] = useState(false);

  const isDirty = useMemo(() => {
    if (activeDirectoryName !== (detail.activeDirectoryName ?? '')) return true;
    if (responsiva !== (detail.responsiva ?? '')) return true;
    for (const t of tools) {
      const current = detail.tools.find((dt) => dt.toolId === t.id);
      const state = toolStates[t.id];
      if (!state) continue;
      if (state.hasAccess !== (current?.hasAccess ?? false)) return true;
      if (state.isAdmin !== (current?.isAdmin ?? false)) return true;
    }
    return false;
  }, [activeDirectoryName, responsiva, toolStates, detail, tools]);

  function setToolState(toolId: string, patch: Partial<ToolState>) {
    setToolStates((prev) => ({ ...prev, [toolId]: { ...prev[toolId]!, ...patch } }));
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/licenses/employees/${detail.employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(activeDirectoryName ? { activeDirectoryName } : {}),
          ...(responsiva ? { responsiva } : {}),
          tools: tools.map((t) => ({
            toolId: t.id,
            hasAccess: toolStates[t.id]?.hasAccess ?? false,
            isAdmin: toolStates[t.id]?.isAdmin ?? false,
          })),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        throw new Error(message ?? 'Error al guardar cambios');
      }

      const updated = (await res.json()) as EmployeeLicenseDetail;
      setDetail(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href="/transformacion/licenciamientos"
        className="text-sm font-medium text-slate-500 hover:text-black"
      >
        ← Volver al maestro de licencias
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{ backgroundColor: avatarColor(detail.fullName) }}
        >
          {detail.photoUrl && !imgFailed ? (
            <img
              src={detail.photoUrl}
              alt={detail.fullName}
              className="h-full w-full rounded-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            initials(detail.fullName)
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">{detail.fullName}</h1>
          <p className="text-sm text-slate-500">{detail.position}</p>
          <p className="text-xs text-slate-400">
            {[detail.area, detail.division].filter(Boolean).join(' / ') || '—'}
            {detail.corporateEmail && ` · ${detail.corporateEmail}`}
          </p>
        </div>
      </div>

      {/* Campos generales */}
      <div className="mt-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Directory name
          </label>
          <input
            type="text"
            value={activeDirectoryName}
            onChange={(e) => { setActiveDirectoryName(e.target.value); setSuccess(false); }}
            placeholder="LV-DG-CEO-NOMBRE"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Responsiva
          </label>
          <input
            type="text"
            value={responsiva}
            onChange={(e) => { setResponsiva(e.target.value); setSuccess(false); }}
            placeholder="TIC-RE-02-0000"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none"
          />
        </div>
      </div>

      {/* Grid de herramientas */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Herramientas</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const state = toolStates[tool.id] ?? { hasAccess: false, isAdmin: false };
            return (
              <div key={tool.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <i className={`ti ${tool.icon} text-lg`} style={{ color: tool.color }} />
                    <span className="text-sm font-medium text-navy">{tool.name}</span>
                  </div>
                  <Toggle checked={state.hasAccess} onChange={(v) => setToolState(tool.id, { hasAccess: v, ...(v ? {} : { isAdmin: false }) })} />
                </div>
                {state.hasAccess && (
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={state.isAdmin}
                      onChange={(e) => setToolState(tool.id, { isAdmin: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    Es admin/superadmin de esta herramienta
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial (placeholder) */}
      <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-400">
        Historial de cambios — próximamente
      </div>

      {/* Guardar */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {success && <span className="text-sm text-emerald-600">Cambios guardados</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            isDirty && !saving
              ? 'bg-black text-white hover:bg-zinc-800'
              : 'cursor-not-allowed bg-slate-100 text-slate-400',
          )}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
