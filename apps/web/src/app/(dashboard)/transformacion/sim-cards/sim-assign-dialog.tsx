'use client';

import { useCallback, useRef, useState } from 'react';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import type { SimCard } from '@/lib/api';
import {
  mustReleaseOriginalEquipment,
  ownedEquipmentPath,
  resolveEquipmentForEmployee,
  toEquipmentChoice,
  type EquipmentChoice,
  type EquipmentSearchRow,
} from './assign-equipment';
import { INPUT_CLASS, LABEL_CLASS, errorMessageOf, formatPhone } from './constants';

/** Sin persona elegida: búsqueda libre de equipos, como siempre. */
function EquipmentSearch({
  value,
  onSelect,
}: {
  value: EquipmentChoice | null;
  onSelect: (e: EquipmentChoice | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EquipmentChoice[]>([]);
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
        setResults(((await res.json()) as EquipmentSearchRow[]).map(toEquipmentChoice));
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
            <span className="font-mono">{value.displayId}</span> · {value.label}
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
              <span className="ml-2 text-navy">{e.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type OwnedState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: EquipmentChoice[] };

interface SimAssignDialogProps {
  sim: SimCard;
  onClose: () => void;
  onSaved: () => void;
}

export function SimAssignDialog({ sim, onClose, onSaved }: SimAssignDialogProps) {
  // El equipo que la línea ya traía: `assign` conserva lo que no se manda, así que
  // si la persona nueva no es su titular hay que soltarlo explícitamente.
  const original: EquipmentChoice | null = sim.equipment
    ? { id: sim.equipment.id, displayId: sim.equipment.displayId, label: sim.equipment.label }
    : null;

  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [equipment, setEquipment] = useState<EquipmentChoice | null>(original);
  const [owned, setOwned] = useState<OwnedState>({ status: 'none' });
  const [equipmentNotice, setEquipmentNotice] = useState<string | null>(null);
  const [assignedDate, setAssignedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // El equipo vigente al terminar de cargar; el estado puede haber cambiado mientras tanto.
  const equipmentRef = useRef(equipment);
  equipmentRef.current = equipment;
  // Descarta respuestas de una persona que ya no es la elegida.
  const requestId = useRef(0);

  async function handleEmployeeChange(next: EmployeePickerValue | null) {
    setEmployee(next);
    const myRequest = ++requestId.current;

    if (!next) {
      // Sin persona el campo vuelve a su comportamiento de siempre.
      setOwned({ status: 'none' });
      const r = resolveEquipmentForEmployee({ selected: equipmentRef.current, original, owned: null });
      setEquipment(r.equipment);
      setEquipmentNotice(null);
      return;
    }

    setOwned({ status: 'loading' });
    setEquipmentNotice(null);
    // Mientras carga no puede quedar seleccionado un equipo de otra persona.
    const previous = equipmentRef.current;
    setEquipment(null);
    try {
      const res = await fetch(ownedEquipmentPath(next.id));
      if (!res.ok) throw new Error();
      const items = ((await res.json()) as EquipmentSearchRow[]).map(toEquipmentChoice);
      if (myRequest !== requestId.current) return;
      setOwned({ status: 'ready', items });
      const r = resolveEquipmentForEmployee({ selected: previous, original, owned: items });
      setEquipment(r.equipment);
      setEquipmentNotice(r.notice);
    } catch {
      if (myRequest !== requestId.current) return;
      // El campo sigue siendo opcional: se puede guardar sin equipo.
      setOwned({ status: 'error' });
      if (previous) setEquipmentNotice(`Se quitó el equipo ${previous.displayId} porque no se pudo comprobar de quién es.`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!employee && !equipment) return setError('Elige la persona o el equipo al que se asigna la línea.');

    setSaving(true);
    try {
      if (employee && mustReleaseOriginalEquipment({ original, selected: equipment })) {
        const rel = await fetch(`/api/sim-cards/${sim.id}/unassign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'equipment', notes: 'Equipo quitado al reasignar la línea a otra persona' }),
        });
        if (!rel.ok) throw new Error(await errorMessageOf(rel, 'No se pudo quitar el equipo anterior.'));
      }
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
          <EmployeePicker label="Persona" value={employee} onSelect={(emp) => void handleEmployeeChange(emp)} />

          <div>
            <span className={LABEL_CLASS}>Equipo (opcional)</span>
            {owned.status === 'none' && <EquipmentSearch value={equipment} onSelect={setEquipment} />}

            {owned.status === 'loading' && <p className="text-sm text-slate-400">Cargando equipos…</p>}

            {owned.status === 'error' && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No se pudieron cargar los equipos de esta persona. Puedes guardar la asignación sin equipo.
              </p>
            )}

            {owned.status === 'ready' &&
              (owned.items.length === 0 ? (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Este colaborador no tiene equipos asignados
                </p>
              ) : (
                <select
                  aria-label="Equipo de la persona"
                  value={equipment?.id ?? ''}
                  onChange={(e) => setEquipment(owned.items.find((i) => i.id === e.target.value) ?? null)}
                  className={INPUT_CLASS}
                >
                  <option value="">Sin equipo</option>
                  {owned.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.displayId} · {i.label}
                    </option>
                  ))}
                </select>
              ))}

            {equipmentNotice && (
              <p role="status" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {equipmentNotice}
              </p>
            )}
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
          <button type="submit" disabled={saving || owned.status === 'loading'} className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Confirmar asignación'}
          </button>
        </div>
      </form>
    </div>
  );
}
