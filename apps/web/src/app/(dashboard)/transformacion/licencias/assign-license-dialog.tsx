'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import type { CreateLicensePayload, ToolRecord } from '@/lib/api';
import { createLicenseAction } from './actions';

interface AssignLicenseDialogProps {
  tools: ToolRecord[];
  open: boolean;
  onClose: () => void;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy focus:ring-1 focus:ring-navy';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export function AssignLicenseDialog({ tools, open, onClose }: AssignLicenseDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toolId, setToolId] = useState('');
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [licenseType, setLicenseType] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  // Solo se pre-llena mientras el usuario no haya tocado el costo: si ya lo
  // editó, cambiar de herramienta no debe pisarle lo que escribió.
  const [costTouched, setCostTouched] = useState(false);

  const selectedTool = useMemo(() => tools.find((t) => t.id === toolId) ?? null, [tools, toolId]);

  if (!open) return null;

  function handleToolChange(id: string) {
    setToolId(id);
    const tool = tools.find((t) => t.id === id);
    if (tool) {
      setCurrency(tool.currency);
      if (!costTouched) setUnitCost(String(tool.unitCost));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!toolId) {
      setError('Selecciona una herramienta.');
      return;
    }

    const payload: CreateLicensePayload = { toolId };
    if (employee) payload.employeeId = employee.id;
    if (licenseType.trim()) payload.licenseType = licenseType.trim();
    if (unitCost !== '') payload.unitCost = Number(unitCost);
    if (currency) payload.currency = currency;
    if (expiresAt) payload.expiresAt = expiresAt;
    if (notes.trim()) payload.notes = notes.trim();

    setSaving(true);
    const result = await createLicenseAction(payload);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'No se pudo asignar la licencia.');
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-visible rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-navy">Asignar licencia</h2>
        <p className="mt-1 text-sm text-slate-500">
          El folio LIC se asigna solo. La unidad de negocio se toma del área del colaborador.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={LABEL}>Herramienta *</label>
            <select
              className={INPUT}
              value={toolId}
              onChange={(e) => handleToolChange(e.target.value)}
              required
            >
              <option value="">Selecciona una herramienta…</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.toolCode} — {t.name} ({t.provider})
                </option>
              ))}
            </select>
            {selectedTool?.requiresApproval && (
              <p className="mt-1 text-xs text-amber-700">
                Esta herramienta requiere aprobación: la licencia queda pendiente y no suma al costo
                hasta aprobarse.
              </p>
            )}
          </div>

          <EmployeePicker label="Colaborador" value={employee} onSelect={setEmployee} />
          {employee?.area && (
            <p className="-mt-2 text-xs text-slate-400">Unidad de negocio: {employee.area}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Tipo de licencia</label>
              <input
                className={INPUT}
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                placeholder="Business, Enterprise…"
                maxLength={100}
              />
            </div>
            <div>
              <label className={LABEL}>Costo unitario</label>
              <input
                className={INPUT}
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => {
                  setCostTouched(true);
                  setUnitCost(e.target.value);
                }}
              />
            </div>
            <div>
              <label className={LABEL}>Moneda</label>
              <select
                className={INPUT}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Vence (opcional)</label>
              <input
                className={INPUT}
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Notas</label>
              <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

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
              {saving ? 'Asignando…' : 'Asignar licencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
