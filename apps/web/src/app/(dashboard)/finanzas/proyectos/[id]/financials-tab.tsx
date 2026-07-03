'use client';

import { useState } from 'react';
import type { ProjectBillingMilestone, ProjectDetail } from '@/lib/api';
import { PlusIcon } from '@/components/icons';

interface Props {
  project: ProjectDetail;
  onUpdate: (p: ProjectDetail) => void;
}

const BILLING_TYPE_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  milestone: 'Por hito',
  hourly: 'Por hora',
  fixed: 'Precio fijo',
};

export function FinancialsTab({ project, onUpdate }: Props) {
  const fin = project.financials;
  const [editingFin, setEditingFin] = useState(false);
  const [finForm, setFinForm] = useState({
    billingType: fin?.billingType ?? 'monthly',
    currency: fin?.currency ?? 'MXN',
    monthlyFee: fin?.monthlyFee ?? '',
    totalValue: fin?.totalValue ?? '',
    overheadPercentage: fin?.overheadPercentage ?? '0',
    billingDay: String(fin?.billingDay ?? 1),
    billingNotes: fin?.billingNotes ?? '',
  });
  const [savingFin, setSavingFin] = useState(false);
  const [finError, setFinError] = useState<string | null>(null);

  // Milestone form
  const [showMilestone, setShowMilestone] = useState(false);
  const [mForm, setMForm] = useState({ name: '', amount: '', dueDate: '' });
  const [addingM, setAddingM] = useState(false);

  async function saveFin() {
    setSavingFin(true);
    setFinError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/financials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billingType: finForm.billingType,
          currency: finForm.currency,
          monthlyFee: finForm.monthlyFee || null,
          totalValue: finForm.totalValue || null,
          overheadPercentage: finForm.overheadPercentage,
          billingDay: parseInt(finForm.billingDay, 10),
          billingNotes: finForm.billingNotes || null,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const updated = await res.json();
      onUpdate({ ...project, financials: updated });
      setEditingFin(false);
    } catch (err) {
      setFinError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingFin(false);
    }
  }

  async function addMilestone() {
    if (!mForm.name || !mForm.amount) return;
    setAddingM(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: mForm.name, amount: mForm.amount, dueDate: mForm.dueDate || null }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const newM = await res.json() as ProjectBillingMilestone;
      onUpdate({ ...project, milestones: [...project.milestones, newM] });
      setMForm({ name: '', amount: '', dueDate: '' });
      setShowMilestone(false);
    } catch {
      // silently fail
    } finally {
      setAddingM(false);
    }
  }

  const fmt = (v: string | null, currency = fin?.currency ?? 'MXN') =>
    v ? new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(parseFloat(v)) : '—';

  return (
    <div className="space-y-6">
      {/* Financial config */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy">Configuración financiera</h2>
          {!editingFin ? (
            <button
              onClick={() => setEditingFin(true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditingFin(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">Cancelar</button>
              <button onClick={saveFin} disabled={savingFin} className="rounded-lg bg-terracota px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                {savingFin ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {finError && <p className="mb-3 text-sm text-red-600">{finError}</p>}

        {!editingFin ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[
              ['Tipo de facturación', BILLING_TYPE_LABELS[fin?.billingType ?? ''] ?? fin?.billingType ?? '—'],
              ['Moneda', fin?.currency ?? '—'],
              ['Cuota mensual', fmt(fin?.monthlyFee ?? null)],
              ['Valor total', fmt(fin?.totalValue ?? null)],
              ['Overhead (%)', fin?.overheadPercentage ?? '0'],
              ['Día de facturación', String(fin?.billingDay ?? '—')],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{l}</p>
                <p className="text-sm text-navy">{v}</p>
              </div>
            ))}
            {fin?.billingNotes && (
              <div className="col-span-2 lg:col-span-3">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Notas</p>
                <p className="text-sm text-navy">{fin.billingNotes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(['billingType', 'currency'] as const).map((k) => (
              <div key={k}>
                <label className="mb-1 block text-xs font-medium text-slate-600">{k === 'billingType' ? 'Tipo' : 'Moneda'}</label>
                {k === 'billingType' ? (
                  <select value={finForm.billingType} onChange={(e) => setFinForm((f) => ({ ...f, billingType: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                    {Object.entries(BILLING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <select value={finForm.currency} onChange={(e) => setFinForm((f) => ({ ...f, currency: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none">
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                )}
              </div>
            ))}
            {[
              { key: 'monthlyFee', label: 'Cuota mensual', type: 'number' },
              { key: 'totalValue', label: 'Valor total', type: 'number' },
              { key: 'overheadPercentage', label: 'Overhead (%)', type: 'number' },
              { key: 'billingDay', label: 'Día de facturación', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
                <input
                  type={type}
                  value={finForm[key as keyof typeof finForm]}
                  onChange={(e) => setFinForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Notas de facturación</label>
              <textarea
                value={finForm.billingNotes}
                onChange={(e) => setFinForm((f) => ({ ...f, billingNotes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Milestones */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy">Hitos de facturación</h2>
          <button
            onClick={() => setShowMilestone(true)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <PlusIcon className="h-4 w-4" />
            Agregar
          </button>
        </div>

        {project.milestones.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin hitos registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100">
              <tr>
                {['Hito', 'Monto', 'Vencimiento', 'Facturado', 'Pagado'].map((h) => (
                  <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {project.milestones.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 font-medium text-navy">{m.name}</td>
                  <td className="py-2 text-slate-600">{fmt(m.amount)}</td>
                  <td className="py-2 text-slate-500">{m.dueDate ?? '—'}</td>
                  <td className="py-2 text-slate-500">{m.invoicedAt ? new Date(m.invoicedAt).toLocaleDateString('es-MX') : '—'}</td>
                  <td className="py-2 text-slate-500">{m.paidAt ? new Date(m.paidAt).toLocaleDateString('es-MX') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showMilestone && (
          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <div className="grid grid-cols-3 gap-3">
              <input value={mForm.name} onChange={(e) => setMForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre del hito" className="col-span-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
              <input type="number" value={mForm.amount} onChange={(e) => setMForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Monto" className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
              <input type="date" value={mForm.dueDate} onChange={(e) => setMForm((f) => ({ ...f, dueDate: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setShowMilestone(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">Cancelar</button>
              <button onClick={addMilestone} disabled={addingM} className="rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                {addingM ? 'Guardando…' : 'Agregar hito'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
