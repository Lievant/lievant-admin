'use client';

import { useCallback, useRef, useState } from 'react';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import type { SimCard } from '@/lib/api';
import { INPUT_CLASS, LABEL_CLASS, errorMessageOf, formatPhone } from './constants';

interface EquipmentOption {
  id: string;
  displayId: string;
  brand: string | null;
  model: string | null;
  type: string;
}

function EquipmentSearch({
  value,
  onSelect,
}: {
  value: EquipmentOption | null;
  onSelect: (e: EquipmentOption | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EquipmentOption[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/inventory/equipment/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        setResults((await res.json()) as EquipmentOption[]);
        setOpen(true);
      }
    } catch {
      /* sin resultados */
    }
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-navy">
            <span className="font-mono">{value.displayId}</span> · {[value.brand, value.model].filter(Boolean).join(' ') || value.type}
          </p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Quitar equipo">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => void search(e.target.value), 300);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar equipo por ID, marca o modelo…"
        className={INPUT_CLASS}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((e) => (
            <li
              key={e.id}
              onMouseDown={() => {
                onSelect(e);
                setQuery('');
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-mono text-xs text-slate-500">{e.displayId}</span>
              <span className="ml-2 text-navy">{[e.brand, e.model].filter(Boolean).join(' ') || e.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SimAssignDialogProps {
  sim: SimCard;
  onClose: () => void;
  onSaved: () => void;
}

export function SimAssignDialog({ sim, onClose, onSaved }: SimAssignDialogProps) {
  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [equipment, setEquipment] = useState<EquipmentOption | null>(null);
  const [assignedDate, setAssignedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employee && !equipment) return setError('Elige la persona o el equipo al que se asigna la línea.');

    setSaving(true);
    try {
      const res = await fetch(`/api/sim-cards/${sim.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(employee ? { employeeId: employee.id } : {}),
          ...(equipment ? { equipmentId: equipment.id } : {}),
          ...(assignedDate ? { assignedDate } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error(await errorMessageOf(res, 'No se pudo asignar la línea.'));
      const updated = (await res.json()) as SimCard;
      // La asignación no se bloquea por un desajuste: se avisa y se deja decidir.
      if (updated.warnings.length > 0) setWarnings(updated.warnings);
      else onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar la línea.');
    } finally {
      setSaving(false);
    }
  }

  if (warnings.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-navy">Línea asignada con avisos</h2>
          <ul className="mt-3 space-y-2">
            {warnings.map((w) => (
              <li key={w} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {w}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onSaved} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-navy">Asignar línea {sim.simCode}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {formatPhone(sim.phoneNumber)} · {sim.plan.name}
        </p>

        {(sim.employee || sim.equipment) && (
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Hoy: {sim.employee ? sim.employee.fullName : 'sin persona'}
            {sim.equipment ? ` · ${sim.equipment.displayId}` : ''}. Lo que elijas reemplaza solo lo que cambies y deja el movimiento en el historial.
          </p>
        )}

        {error && <div className="mt-4 rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>}

        <div className="mt-5 space-y-4">
          <EmployeePicker label="Persona" value={employee} onSelect={setEmployee} />
          <div>
            <span className={LABEL_CLASS}>Equipo (opcional)</span>
            <EquipmentSearch value={equipment} onSelect={setEquipment} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="assign-date">Fecha de asignación</label>
            <input id="assign-date" type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} className={INPUT_CLASS} />
            <p className="mt-1 text-xs text-slate-400">Si la dejas vacía se usa la de hoy.</p>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="assign-notes">Notas</label>
            <textarea id="assign-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Confirmar asignación'}
          </button>
        </div>
      </form>
    </div>
  );
}
