'use client';

import { useMemo, useState } from 'react';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import type { SimCard, SimCurrency, SimDeviceType, SimPlan, SimStatus } from '@/lib/api';
import { INPUT_CLASS, LABEL_CLASS, SIM_DEVICE_LABEL, SIM_STATUS_LABEL, errorMessageOf, formatMoney } from './constants';

interface SimFormDialogProps {
  /** null = alta. */
  sim: SimCard | null;
  plans: SimPlan[];
  onClose: () => void;
  onSaved: () => void;
}

/** Solo dígitos y un punto decimal; '' = sin costo propio. */
function parseCost(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

export function SimFormDialog({ sim, plans, onClose, onSaved }: SimFormDialogProps) {
  const isEdit = sim !== null;
  const [phoneNumber, setPhoneNumber] = useState(sim?.phoneNumber ?? '');
  const [iccid, setIccid] = useState(sim?.iccid ?? '');
  const [planId, setPlanId] = useState(sim?.plan.id ?? '');
  const [ownCost, setOwnCost] = useState(sim?.ownMonthlyCost !== null && sim?.ownMonthlyCost !== undefined ? String(sim.ownMonthlyCost) : '');
  const [currency, setCurrency] = useState<SimCurrency>(sim?.currency ?? 'MXN');
  const [termMonths, setTermMonths] = useState(sim?.termMonths ? String(sim.termMonths) : '');
  const [contractEndDate, setContractEndDate] = useState(sim?.contractEndDate ?? '');
  const [activationDate, setActivationDate] = useState(sim?.activationDate ?? '');
  const [status, setStatus] = useState<SimStatus>(sim?.status ?? 'activa');
  const [deviceType, setDeviceType] = useState<SimDeviceType>(sim?.deviceType ?? 'smartphone');
  const [notes, setNotes] = useState(sim?.notes ?? '');
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Planes activos; al editar se conserva el actual aunque ya esté desactivado.
  const planOptions = useMemo(
    () => plans.filter((p) => p.isActive || p.id === sim?.plan.id),
    [plans, sim?.plan.id],
  );
  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const showsIccid = !isEdit || sim?.iccid !== undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phoneNumber.trim()) return setError('Escribe el número de la línea.');
    if (!planId) return setError('Selecciona el plan.');
    const cost = parseCost(ownCost);
    if (cost === 'invalid') return setError('El costo propio debe ser un número mayor o igual a 0.');
    const term = termMonths.trim() ? Number(termMonths) : null;
    if (term !== null && (!Number.isInteger(term) || term < 1)) return setError('El plazo debe ser un número entero de meses.');
    if (activationDate && contractEndDate && contractEndDate < activationDate) {
      return setError('El vencimiento no puede ser anterior a la fecha de activación.');
    }

    const payload: Record<string, unknown> = {
      phoneNumber: phoneNumber.trim(),
      planId,
      monthlyCost: cost,
      termMonths: term,
      contractEndDate: contractEndDate || null,
      activationDate: activationDate || null,
      status,
      deviceType,
      notes: notes.trim() || null,
    };
    if (cost !== null) payload.currency = currency;
    if (showsIccid) payload.iccid = iccid.trim() || null;
    // La persona solo viaja al crear; después cambia por Asignar / Desasignar.
    if (!isEdit && employee) payload.employeeId = employee.id;

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/sim-cards/${sim.id}` : '/api/sim-cards', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo guardar la línea.'));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la línea.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-navy">{isEdit ? `Editar línea ${sim.simCode}` : 'Nueva línea'}</h2>

        {error && <div className="mt-4 rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="sim-phone">Número de la línea *</label>
            <input
              id="sim-phone"
              type="text"
              inputMode="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="477 123 4567"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-slate-400">10 dígitos; se acepta el prefijo +52.</p>
          </div>

          {showsIccid && (
            <div>
              <label className={LABEL_CLASS} htmlFor="sim-iccid">ICCID</label>
              <input
                id="sim-iccid"
                type="text"
                inputMode="numeric"
                value={iccid}
                onChange={(e) => setIccid(e.target.value)}
                placeholder="8952 1400 0000 0000 001"
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={LABEL_CLASS} htmlFor="sim-plan">Plan *</label>
            <select id="sim-plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={INPUT_CLASS}>
              <option value="">Selecciona un plan…</option>
              {planOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.vendor.name ?? 'Sin proveedor'} ({formatMoney(p.monthlyCost, p.currency)})
                </option>
              ))}
            </select>
            {plans.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">Aún no hay planes. Créalos desde «Administrar planes».</p>
            )}
            {selectedPlan && (
              <p className="mt-1 text-xs text-slate-400">Proveedor: {selectedPlan.vendor.name ?? '—'}</p>
            )}
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="sim-cost">Costo propio mensual</label>
            <div className="flex gap-2">
              <input
                id="sim-cost"
                type="text"
                inputMode="decimal"
                value={ownCost}
                onChange={(e) => setOwnCost(e.target.value)}
                placeholder={selectedPlan ? `Plan: ${selectedPlan.monthlyCost}` : 'Opcional'}
                className={INPUT_CLASS}
              />
              <select
                aria-label="Moneda del costo propio"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as SimCurrency)}
                disabled={!ownCost.trim()}
                className={`${INPUT_CLASS} w-24`}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-400">Si lo dejas vacío se usa el costo del plan.</p>
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="sim-term">Plazo (meses)</label>
            <input
              id="sim-term"
              type="number"
              min={1}
              step={1}
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              placeholder="12"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="sim-activation">Fecha de activación</label>
            <input id="sim-activation" type="date" value={activationDate} onChange={(e) => setActivationDate(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="sim-end">Fecha de vencimiento</label>
            <input id="sim-end" type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} className={INPUT_CLASS} />
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="sim-status">Estado</label>
            <select id="sim-status" value={status} onChange={(e) => setStatus(e.target.value as SimStatus)} className={INPUT_CLASS}>
              {(Object.keys(SIM_STATUS_LABEL) as SimStatus[]).map((s) => (
                <option key={s} value={s}>{SIM_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="sim-device">Tipo de dispositivo</label>
            <select id="sim-device" value={deviceType} onChange={(e) => setDeviceType(e.target.value as SimDeviceType)} className={INPUT_CLASS}>
              {(Object.keys(SIM_DEVICE_LABEL) as SimDeviceType[]).map((d) => (
                <option key={d} value={d}>{SIM_DEVICE_LABEL[d]}</option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div className="sm:col-span-2">
              <EmployeePicker label="Asignar a (opcional)" value={employee} onSelect={setEmployee} />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={LABEL_CLASS} htmlFor="sim-notes">Notas</label>
            <textarea id="sim-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>

        {isEdit && (
          <p className="mt-4 text-xs text-slate-400">
            La persona y el equipo de la línea se cambian con «Asignar» o «Desasignar», para que el historial quede completo.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear línea'}
          </button>
        </div>
      </form>
    </div>
  );
}
