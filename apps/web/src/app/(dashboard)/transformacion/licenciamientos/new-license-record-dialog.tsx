'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloseIcon } from '@/components/icons';

interface EmployeeSuggestion {
  id: string;
  displayId: string;
  fullName: string;
  corporateEmail: string | null;
  position: string;
  area: string | null;
}

export function NewLicenseRecordDialog({
  existingEmployeeIds,
  onClose,
}: {
  existingEmployeeIds: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = new Set(existingEmployeeIds);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EmployeeSuggestion | null>(null);
  const [alreadyHas, setAlreadyHas] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/employees/search-for-assignment?q=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        setSuggestions(((await res.json()) as EmployeeSuggestion[]) ?? []);
        setOpen(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    setSelected(null);
    setAlreadyHas(false);
    setError(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(emp: EmployeeSuggestion) {
    setQuery(emp.fullName);
    setSuggestions([]);
    setOpen(false);
    setSelected(emp);
    setAlreadyHas(existing.has(emp.id));
  }

  async function handleCreate() {
    if (!selected || alreadyHas) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/licenses/employees/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: [] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
        throw new Error(msg ?? 'No se pudo crear el registro.');
      }
      router.push(`/transformacion/licenciamientos/${selected.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-navy">Agregar empleado</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Empleado
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Buscar empleado…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-terracota focus:outline-none"
            />
            {open && suggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {suggestions.map((emp) => (
                  <li
                    key={emp.id}
                    onMouseDown={() => handleSelect(emp)}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-navy">{emp.fullName}</span>
                    <span className="ml-2 text-slate-500">{emp.position}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && alreadyHas && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Este empleado ya tiene licencias registradas.
            </div>
          )}

          {selected && !alreadyHas && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Se creará un registro de licencias para <span className="font-semibold text-navy">{selected.fullName}</span>.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!selected || alreadyHas || submitting}
            className="rounded-md bg-terracota px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Creando…' : 'Crear registro'}
          </button>
        </div>
      </div>
    </div>
  );
}
