'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmployeePicker, type EmployeePickerValue } from '../../rrhh/empleados/employee-picker';
import type { AssignerRecord, CreateAssignmentPayload, ToolRecord } from '@/lib/api';
import { createAssignmentAction } from './actions';
import { todayISO } from './constants';

interface NewAssignmentDialogProps {
  tools: ToolRecord[];
  assigners: AssignerRecord[];
  open: boolean;
  onClose: () => void;
}

const INPUT =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-navy focus:ring-1 focus:ring-navy';
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export function NewAssignmentDialog({
  tools,
  assigners,
  open,
  onClose,
}: NewAssignmentDialogProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employee, setEmployee] = useState<EmployeePickerValue | null>(null);
  const [toolQuery, setToolQuery] = useState('');
  const [toolId, setToolId] = useState('');
  const [assignedById, setAssignedById] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(todayISO());
  const [lastUsedDate, setLastUsedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Búsqueda sobre el catálogo ya cargado: son decenas de herramientas, no
  // miles, así que filtrar en memoria evita un round-trip por tecla.
  const filteredTools = useMemo(() => {
    const q = toolQuery.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.provider.toLowerCase().includes(q) ||
        t.toolCode.toLowerCase().includes(q),
    );
  }, [tools, toolQuery]);

  const selectedTool = useMemo(() => tools.find((t) => t.id === toolId) ?? null, [tools, toolId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!employee) {
      setError('Selecciona un colaborador.');
      return;
    }
    if (!toolId) {
      setError('Selecciona una herramienta.');
      return;
    }

    const payload: CreateAssignmentPayload = { toolId, employeeId: employee.id };
    if (assignedById) payload.assignedById = assignedById;
    if (assignmentDate) payload.assignmentDate = assignmentDate;
    if (lastUsedDate) payload.lastUsedDate = lastUsedDate;
    if (notes.trim()) payload.notes = notes.trim();

    setSaving(true);
    const result = await createAssignmentAction(payload);
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? 'No se pudo crear la asignación.');
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-navy">Nueva asignación</h2>
        <p className="mt-1 text-sm text-slate-500">
          El folio ASG se asigna solo. Una persona no puede tener la misma herramienta activa dos
          veces.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <EmployeePicker label="Colaborador *" value={employee} onSelect={setEmployee} />
          {employee?.area && (
            <p className="-mt-2 text-xs text-slate-400">Área: {employee.area}</p>
          )}

          <div>
            <label className={LABEL}>Herramienta *</label>
            <input
              className={`${INPUT} mb-2`}
              value={toolQuery}
              onChange={(e) => setToolQuery(e.target.value)}
              placeholder="Buscar por nombre, proveedor o código…"
            />
            <select
              className={INPUT}
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              size={Math.min(6, Math.max(2, filteredTools.length))}
            >
              {filteredTools.length === 0 && <option value="">Sin resultados</option>}
              {filteredTools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.toolCode} — {t.name} ({t.provider})
                </option>
              ))}
            </select>
            {selectedTool?.requiresApproval && (
              <p className="mt-1 text-xs text-amber-700">
                Esta herramienta requiere aprobación: se notificará según el flujo configurado.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL}>Asignado por</label>
              <select
                className={INPUT}
                value={assignedById}
                onChange={(e) => setAssignedById(e.target.value)}
              >
                <option value="">Yo mismo</option>
                {assigners.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Fecha de asignación</label>
              <input
                className={INPUT}
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Último uso conocido</label>
              <input
                className={INPUT}
                type="date"
                value={lastUsedDate}
                onChange={(e) => setLastUsedDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Notas</label>
            <textarea
              className={`${INPUT} min-h-[72px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
              {saving ? 'Asignando…' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
