'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientListItem, EmployeeListItem } from '@/lib/api';
import { cn } from '@/lib/utils';

const BUSINESS_UNITS = ['SIOcore', 'Omnicanalidad', 'Marketing Digital', 'Transformación Digital', 'SGSI'];

interface Props {
  clients: ClientListItem[];
  employees: EmployeeListItem[];
}

type Step = 1 | 2 | 3;

interface FormData {
  name: string;
  description: string;
  projectType: string;
  status: string;
  clientRecordId: string;
  primaryBusinessUnit: string;
  startDate: string;
  endDate: string;
  pmCode: string;
  projectManagerId: string;
  billingType: string;
  currency: string;
  monthlyFee: string;
  totalValue: string;
}

const INITIAL: FormData = {
  name: '',
  description: '',
  projectType: 'recurring',
  status: 'active',
  clientRecordId: '',
  primaryBusinessUnit: '',
  startDate: '',
  endDate: '',
  pmCode: '',
  projectManagerId: '',
  billingType: 'monthly',
  currency: 'MXN',
  monthlyFee: '',
  totalValue: '',
};

export function NewProjectForm({ clients, employees }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormData, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function nextStep() {
    if (step === 1 && !form.name.trim()) { setError('El nombre es obligatorio'); return; }
    setError(null);
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        projectType: form.projectType,
        status: form.status,
      };
      if (form.description) body.description = form.description;
      if (form.clientRecordId) body.clientRecordId = form.clientRecordId;
      if (form.primaryBusinessUnit) body.primaryBusinessUnit = form.primaryBusinessUnit;
      if (form.startDate) body.startDate = form.startDate;
      if (form.endDate) body.endDate = form.endDate;
      if (form.pmCode) body.pmCode = form.pmCode;
      if (form.projectManagerId) body.projectManagerId = form.projectManagerId;

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(msg.message ?? `Error ${res.status}`);
      }

      const project = await res.json() as { id: string };

      if (form.billingType && (form.monthlyFee || form.totalValue)) {
        const finBody: Record<string, unknown> = { billingType: form.billingType, currency: form.currency };
        if (form.monthlyFee) finBody.monthlyFee = form.monthlyFee;
        if (form.totalValue) finBody.totalValue = form.totalValue;
        await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ financials: finBody }),
          credentials: 'include',
        });
      }

      router.push(`/finanzas/proyectos/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el proyecto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Step indicator */}
      <div className="flex border-b border-slate-100">
        {([1, 2, 3] as const).map((s) => (
          <div
            key={s}
            className={cn(
              'flex-1 py-3 text-center text-sm font-medium',
              step === s ? 'border-b-2 border-terracota text-terracota' : 'text-slate-400',
            )}
          >
            {s === 1 ? 'Datos generales' : s === 2 ? 'Equipo' : 'Financiero'}
          </div>
        ))}
      </div>

      <div className="p-6">
        {/* Step 1: General */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre del proyecto *</label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
                placeholder="Ej. SIOcore Acme 2025"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracota/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  value={form.projectType}
                  onChange={(e) => set('projectType', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="recurring">Recurrente</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="active">Activo</option>
                  <option value="paused">Pausado</option>
                  <option value="closed">Cerrado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cliente</label>
              <select
                value={form.clientRecordId}
                onChange={(e) => set('clientRecordId', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— Sin cliente —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.primaryCompany.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Área principal</label>
              <select
                value={form.primaryBusinessUnit}
                onChange={(e) => set('primaryBusinessUnit', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— Sin área —</option>
                {BUSINESS_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha inicio</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set('startDate', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha fin</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Código en Cor</label>
              <input
                value={form.pmCode}
                onChange={(e) => set('pmCode', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                placeholder="OMN-SIOcore-..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Team */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Project Manager</label>
              <select
                value={form.projectManagerId}
                onChange={(e) => set('projectManagerId', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— Sin PM asignado —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-slate-400">
              Puedes agregar más miembros del equipo desde el detalle del proyecto después de crearlo.
            </p>
          </div>
        )}

        {/* Step 3: Financial */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de facturación</label>
                <select
                  value={form.billingType}
                  onChange={(e) => set('billingType', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="monthly">Mensual</option>
                  <option value="milestone">Por hito</option>
                  <option value="hourly">Por hora</option>
                  <option value="fixed">Precio fijo</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Moneda</label>
                <select
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            {form.billingType === 'monthly' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cuota mensual</label>
                <input
                  type="number"
                  value={form.monthlyFee}
                  onChange={(e) => set('monthlyFee', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Valor total del proyecto</label>
              <input
                type="number"
                value={form.totalValue}
                onChange={(e) => set('totalValue', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <p className="text-sm text-slate-400">
              Puedes configurar hitos, comisiones y notas de facturación desde el detalle del proyecto.
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            disabled={step === 1}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Atrás
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-terracota px-4 py-2 text-sm font-medium text-white hover:bg-terracota/90 disabled:opacity-60"
            >
              {saving ? 'Creando…' : 'Crear proyecto'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
