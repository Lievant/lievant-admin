'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SimCurrency, SimPlan } from '@/lib/api';
import { VendorPicker } from '../inventario/vendor-picker';
import { INPUT_CLASS, LABEL_CLASS, errorMessageOf, formatMoney } from './constants';

interface PlanForm {
  id: string | null;
  name: string;
  vendorId: string;
  vendorName: string | null;
  monthlyCost: string;
  currency: SimCurrency;
  description: string;
  isActive: boolean;
}

const EMPTY: PlanForm = {
  id: null,
  name: '',
  vendorId: '',
  vendorName: null,
  monthlyCost: '',
  currency: 'MXN',
  description: '',
  isActive: true,
};

/**
 * Catálogo de planes de telefonía. Vive aquí y no en /admin/catalogos porque el
 * plan lleva proveedor, costo y moneda, y el catálogo genérico solo maneja
 * campos de texto, fecha, casilla y lista.
 */
export function SimPlansDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [plans, setPlans] = useState<SimPlan[] | null>(null);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/sim-cards/plans');
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudieron cargar los planes.'));
      setPlans((await res.json()) as SimPlan[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los planes.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(plan: SimPlan) {
    setError(null);
    setForm({
      id: plan.id,
      name: plan.name,
      vendorId: plan.vendor.id,
      vendorName: plan.vendor.name,
      monthlyCost: String(plan.monthlyCost),
      currency: plan.currency,
      description: plan.description ?? '',
      isActive: plan.isActive,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    if (!form.name.trim()) return setError('Escribe el nombre del plan.');
    if (!form.vendorId) return setError('Selecciona el proveedor.');
    const cost = Number(form.monthlyCost);
    if (!form.monthlyCost.trim() || !Number.isFinite(cost) || cost < 0) {
      return setError('El costo mensual debe ser un número mayor o igual a 0.');
    }

    setSaving(true);
    try {
      const res = await fetch(form.id ? `/api/sim-cards/plans/${form.id}` : '/api/sim-cards/plans', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          vendorId: form.vendorId,
          monthlyCost: cost,
          currency: form.currency,
          description: form.description.trim() || null,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo guardar el plan.'));
      setForm(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el plan.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(plan: SimPlan) {
    setError(null);
    if (!window.confirm(`¿Eliminar el plan «${plan.name}»?`)) return;
    try {
      const res = await fetch(`/api/sim-cards/plans/${plan.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo eliminar el plan.'));
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el plan.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy">Planes de telefonía</h2>
            <p className="mt-1 text-sm text-slate-500">El proveedor de cada línea es el de su plan.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && <div className="mt-4 rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>}

        {form ? (
          <form onSubmit={save} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="plan-name">Nombre *</label>
              <input id="plan-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <span className={LABEL_CLASS}>Proveedor *</span>
              <VendorPicker
                value={form.vendorId}
                initialName={form.vendorName}
                onChange={(id, vendor) => setForm({ ...form, vendorId: id, vendorName: vendor?.name ?? null })}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="plan-cost">Costo mensual *</label>
              <input id="plan-cost" type="text" inputMode="decimal" value={form.monthlyCost} onChange={(e) => setForm({ ...form, monthlyCost: e.target.value })} className={INPUT_CLASS} />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="plan-currency">Moneda</label>
              <select id="plan-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as SimCurrency })} className={INPUT_CLASS}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL_CLASS} htmlFor="plan-desc">Descripción</label>
              <textarea id="plan-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={INPUT_CLASS} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Plan activo (disponible al registrar líneas)
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setForm(null)} className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
                {saving ? 'Guardando…' : form.id ? 'Guardar plan' : 'Crear plan'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setForm(EMPTY);
                }}
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Nuevo plan
              </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Costo mensual</th>
                    <th className="px-4 py-3">Líneas</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plans === null ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cargando…</td>
                    </tr>
                  ) : plans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aún no hay planes registrados.</td>
                    </tr>
                  ) : (
                    plans.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-navy">{p.name}</td>
                        <td className="px-4 py-3 text-slate-700">{p.vendor.name ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatMoney(p.monthlyCost, p.currency)}</td>
                        <td className="px-4 py-3 text-slate-600">{p.simCount}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                            {p.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button type="button" onClick={() => edit(p)} className="text-xs font-medium text-black hover:underline">
                            Editar
                          </button>
                          <button type="button" onClick={() => void remove(p)} className="ml-3 text-xs font-medium text-red-600 hover:underline">
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
