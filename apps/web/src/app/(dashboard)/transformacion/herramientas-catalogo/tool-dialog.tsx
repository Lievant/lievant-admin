'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  CreateToolRecordPayload,
  ToolBillingPeriod,
  ToolContractStatus,
  ToolOptions,
  ToolRecord,
} from '@/lib/api';
import { createToolRecordAction, updateToolRecordAction } from './actions';
import { BILLING_PERIOD_LABEL, CONTRACT_STATUS_LABEL } from './constants';

interface ToolDialogProps {
  options: ToolOptions;
  /** Presente = edición; ausente = alta. */
  tool?: ToolRecord;
  open: boolean;
  onClose: () => void;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy focus:ring-1 focus:ring-navy';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export function ToolDialog({ options, tool, open, onClose }: ToolDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: tool?.name ?? '',
    category: tool?.category ?? options.categories[0] ?? 'Otro',
    provider: tool?.provider ?? '',
    description: tool?.description ?? '',
    unitCost: tool ? String(tool.unitCost) : '0',
    currency: tool?.currency ?? 'MXN',
    billingPeriod: (tool?.billingPeriod ?? 'mensual') as ToolBillingPeriod,
    billingDay: tool?.billingDay ? String(tool.billingDay) : '',
    commercialContact: tool?.commercialContact ?? '',
    nextRenewalDate: tool?.nextRenewalDate?.slice(0, 10) ?? '',
    contractStatus: (tool?.contractStatus ?? 'activo') as ToolContractStatus,
    requiresApproval: tool?.requiresApproval ?? false,
  });

  if (!open) return null;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim() || !form.provider.trim()) {
      setError('Nombre y proveedor son obligatorios.');
      return;
    }

    // Los opcionales vacíos se omiten en vez de mandarse como '': el DTO los
    // validaría como cadena inválida (IsUrl, IsDateString) y rebotaría el alta.
    const payload: CreateToolRecordPayload = {
      name: form.name.trim(),
      category: form.category,
      provider: form.provider.trim(),
      billingPeriod: form.billingPeriod,
      unitCost: Number(form.unitCost) || 0,
      currency: form.currency,
      contractStatus: form.contractStatus,
      requiresApproval: form.requiresApproval,
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.billingDay) payload.billingDay = Number(form.billingDay);
    if (form.commercialContact.trim()) payload.commercialContact = form.commercialContact.trim();
    if (form.nextRenewalDate) payload.nextRenewalDate = form.nextRenewalDate;

    setSaving(true);
    const result = tool
      ? await updateToolRecordAction(tool.id, payload)
      : await createToolRecordAction(payload);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'No se pudo guardar.');
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-navy">
          {tool ? `Editar ${tool.toolCode}` : 'Nueva herramienta'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {tool
            ? 'Los cambios de costo unitario recalculan el costo total de la herramienta.'
            : 'El código HTA se asigna automáticamente al guardar.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL}>Nombre *</label>
              <input
                className={INPUT}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className={LABEL}>Categoría *</label>
              <select
                className={INPUT}
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                {options.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Proveedor *</label>
              <input
                className={INPUT}
                value={form.provider}
                onChange={(e) => set('provider', e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL}>Descripción (opcional)</label>
              <textarea
                className={`${INPUT} min-h-[72px]`}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Costos y facturación
            </legend>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <label className={LABEL}>Costo unitario</label>
                <input
                  className={INPUT}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitCost}
                  onChange={(e) => set('unitCost', e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Moneda</label>
                <select
                  className={INPUT}
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                >
                  {options.currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Periodo *</label>
                <select
                  className={INPUT}
                  value={form.billingPeriod}
                  onChange={(e) => set('billingPeriod', e.target.value as ToolBillingPeriod)}
                >
                  {options.billingPeriods.map((p) => (
                    <option key={p} value={p}>
                      {BILLING_PERIOD_LABEL[p] ?? p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Día de cobro</label>
                <input
                  className={INPUT}
                  type="number"
                  min="1"
                  max="31"
                  value={form.billingDay}
                  onChange={(e) => set('billingDay', e.target.value)}
                  placeholder="1–31"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Administración
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Contacto comercial</label>
                <input
                  className={INPUT}
                  value={form.commercialContact}
                  onChange={(e) => set('commercialContact', e.target.value)}
                  maxLength={200}
                />
              </div>
              <div>
                <label className={LABEL}>Próxima renovación</label>
                <input
                  className={INPUT}
                  type="date"
                  value={form.nextRenewalDate}
                  onChange={(e) => set('nextRenewalDate', e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Estado del contrato</label>
                <select
                  className={INPUT}
                  value={form.contractStatus}
                  onChange={(e) => set('contractStatus', e.target.value as ToolContractStatus)}
                >
                  {options.contractStatuses.map((s) => (
                    <option key={s} value={s}>
                      {CONTRACT_STATUS_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={form.requiresApproval}
                  onChange={(e) => set('requiresApproval', e.target.checked)}
                />
                <span className="text-sm text-navy">
                  Requiere aprobación para asignarse
                  <span className="ml-1 text-xs text-slate-400">
                    (las asignaciones nacen pendientes y no suman al costo hasta aprobarse)
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
