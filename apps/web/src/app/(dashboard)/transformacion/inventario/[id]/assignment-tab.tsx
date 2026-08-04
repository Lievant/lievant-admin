'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { avatarColor, initials } from '@/lib/avatar';
import type { EquipmentDetail } from '@/lib/api';
import { formatDate, statusBadgeStyle, typeIcon } from '../constants';

interface OtherEquipmentItem {
  id: string;
  displayId: string;
  legacyId: string | null;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  status: string;
}

interface EmployeeSuggestion {
  id: string;
  displayId: string;
  fullName: string;
  corporateEmail: string | null;
  position: string;
  area: string | null;
}

function EmployeeSearch({ onSelect }: { onSelect: (emp: EmployeeSuggestion) => void }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/employees/search-for-assignment?q=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const results = (await res.json()) as EmployeeSuggestion[];
        setSuggestions(results ?? []);
        setOpen(true);
      }
    } catch { /* noop */ }
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(emp: EmployeeSuggestion) {
    setQuery(emp.fullName);
    setSuggestions([]);
    setOpen(false);
    onSelect(emp);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Buscar empleado…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((emp) => (
            <li key={emp.id} onMouseDown={() => handleSelect(emp)} className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50">
              <span className="font-medium text-navy">{emp.fullName}</span>
              <span className="ml-2 text-slate-500">{emp.position}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  equipment: EquipmentDetail;
  onUpdated: (e: EquipmentDetail) => void;
}

export function AssignmentTab({ equipment, onUpdated }: Props) {
  const [assigning, setAssigning] = useState(false);
  const [newEmployee, setNewEmployee] = useState<EmployeeSuggestion | null>(null);
  const [assignmentDate, setAssignmentDate] = useState('');
  const [responsiva, setResponsiva] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unassignNote, setUnassignNote] = useState('');
  const [confirmUnassign, setConfirmUnassign] = useState(false);

  const emp = equipment.assignedEmployee;
  const empName = emp?.fullName ?? null;
  const empEmail = emp?.corporateEmail ?? null;
  const [imgSrc, setImgSrc] = useState<string | null>(empEmail ? `/api/users/${encodeURIComponent(empEmail)}/photo` : null);

  const [otherEquipment, setOtherEquipment] = useState<OtherEquipmentItem[]>([]);
  const [loadingOther, setLoadingOther] = useState(false);

  useEffect(() => {
    if (!emp) {
      setOtherEquipment([]);
      return;
    }
    setLoadingOther(true);
    fetch(`/api/inventory/equipment/${equipment.id}/employee-equipment`)
      .then((res) => (res.ok ? (res.json() as Promise<OtherEquipmentItem[]>) : []))
      .then((items) => setOtherEquipment(items))
      .catch(() => setOtherEquipment([]))
      .finally(() => setLoadingOther(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipment.id, emp?.id]);

  async function handleAssign() {
    if (!newEmployee) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/equipment/${equipment.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: newEmployee.id,
          assignmentDate: assignmentDate || undefined,
          responsiva: responsiva || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Error');
      const updated = await res.json() as EquipmentDetail;
      onUpdated(updated);
      setAssigning(false);
      setNewEmployee(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassign() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/equipment/${equipment.id}/unassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: unassignNote || undefined }),
      });
      if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Error');
      const updated = await res.json() as EquipmentDetail;
      onUpdated(updated);
      setConfirmUnassign(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">{error}</div>
      )}

      {/* Empleado actual */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">Empleado asignado actualmente</h3>
        {emp ? (
          <div className="mt-4 flex items-start gap-4">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: avatarColor(empName ?? '') }}
            >
              {imgSrc ? (
                <img src={imgSrc} alt={empName ?? ''} className="h-full w-full rounded-full object-cover" onError={() => setImgSrc(null)} />
              ) : (
                initials(empName ?? '')
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-navy">{emp.fullName}</p>
              <p className="text-sm text-slate-500">{emp.position}</p>
              {emp.area && <p className="text-xs text-slate-400">{emp.area} · {emp.location}</p>}
              <div className="mt-2 flex gap-6 text-xs text-slate-500">
                <span>Fecha asignación: <strong>{formatDate(equipment.assignmentDate)}</strong></span>
                {equipment.responsiva && <span>Responsiva: <strong>{equipment.responsiva}</strong></span>}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Sin asignación activa.</p>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={() => setAssigning(true)} className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
            {emp ? 'Cambiar asignación' : 'Asignar empleado'}
          </button>
          {emp && (
            <button onClick={() => setConfirmUnassign(true)} className="rounded-md border border-red-200 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Desasignar
            </button>
          )}
        </div>
      </div>

      {/* Otros equipos del colaborador */}
      {emp && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">Otros equipos de este colaborador</h3>
          {loadingOther ? (
            <p className="mt-3 text-sm text-slate-400">Cargando…</p>
          ) : otherEquipment.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Este es el único equipo asignado a {emp.fullName}.</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">ID Legado</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Marca / Modelo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {otherEquipment.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.legacyId ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <i className={`ti ${typeIcon(item.equipmentType)} text-slate-400`} />
                          <span className="text-slate-700">{item.equipmentType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-navy">{item.brand ?? ''}</span>
                        {item.model && <span className="ml-1 text-slate-500">{item.model}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyle(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/transformacion/inventario/${item.id}`}
                          className="text-xs font-medium text-black hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Formulario de asignación */}
      {assigning && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Nueva asignación</h3>
          <EmployeeSearch onSelect={setNewEmployee} />
          {newEmployee && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha de asignación</label>
                <input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">No. de responsiva</label>
                <input type="text" value={responsiva} onChange={(e) => setResponsiva(e.target.value)} placeholder="TIC-RE-02-XXXX" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none" />
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button onClick={handleAssign} disabled={!newEmployee || saving} className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Confirmar asignación'}
            </button>
            <button onClick={() => setAssigning(false)} className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Confirmar desasignación */}
      {confirmUnassign && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-700">Confirmar desasignación</h3>
          <p className="mt-1 text-sm text-red-600">El equipo pasará a estado &quot;Disponible&quot;.</p>
          <textarea
            value={unassignNote}
            onChange={(e) => setUnassignNote(e.target.value)}
            placeholder="Motivo (opcional)…"
            rows={2}
            className="mt-3 w-full rounded-md border border-red-200 px-3 py-2 text-sm focus:outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button onClick={handleUnassign} disabled={saving} className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Procesando…' : 'Desasignar'}
            </button>
            <button onClick={() => setConfirmUnassign(false)} className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Historial de asignaciones */}
      {equipment.history.filter((h) => h.action === 'ASIGNADO' || h.action === 'DESASIGNADO').length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Historial de asignaciones</h3>
          <ul className="space-y-3">
            {equipment.history
              .filter((h) => h.action === 'ASIGNADO' || h.action === 'DESASIGNADO')
              .map((h) => (
                <li key={h.id} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${h.action === 'ASIGNADO' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {h.action}
                  </span>
                  <div>
                    <p className="text-slate-700">{h.notes ?? (h.newValue ?? h.oldValue ?? '')}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {h.changedByName} · {new Date(h.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
