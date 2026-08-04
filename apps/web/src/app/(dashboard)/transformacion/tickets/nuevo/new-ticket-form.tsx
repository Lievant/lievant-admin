'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { HelpdeskCategorySummary, HelpdeskSubcategorySummary, TicketAssignee, TicketImpact } from '@/lib/api';
import { createTicketAction } from './actions';

const CATEGORY_PLACEHOLDERS: Record<string, string> = {
  equipos: 'Ej: Mi laptop no enciende / la pantalla parpadea / teclado sin respuesta…',
  software: 'Ej: No puedo abrir Excel / la aplicación muestra error al iniciar…',
  conectividad: 'Ej: Sin acceso a internet desde mi equipo / VPN no conecta…',
  accesos: 'Ej: Olvidé mi contraseña de Windows / no puedo entrar al sistema…',
  correo: 'Ej: No recibo correos / mi cuenta de Outlook no sincroniza…',
  infraestructura: 'Ej: El servidor de archivos está lento / el dominio no responde…',
  seguridad: 'Ej: Recibí un correo de phishing / sospecho acceso no autorizado…',
};

interface EmployeeSuggestion {
  id: string;
  fullName: string;
  position: string;
  area: string | null;
}

function EmployeeSearch({
  value,
  onSelect,
  placeholder,
}: {
  value: string;
  onSelect: (emp: EmployeeSuggestion) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const page = (await res.json()) as { data: EmployeeSuggestion[] };
        setSuggestions(page.data ?? []);
        setOpen(true);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void search(q), 350);
  }

  function handleSelect(emp: EmployeeSuggestion) {
    setQuery(emp.fullName);
    onSelect(emp);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-xs text-slate-400">buscando…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((emp) => (
            <li key={emp.id}>
              <button
                type="button"
                onMouseDown={() => handleSelect(emp)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-navy">{emp.fullName}</span>
                <span className="text-xs text-slate-400">
                  {[emp.position, emp.area].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface NewTicketFormProps {
  categories: HelpdeskCategorySummary[];
  isTd: boolean;
}

interface FormState {
  category: string;
  subcategory: string;
  equipmentId: string;
  description: string;
  impact: TicketImpact;
  openedOnBehalfOf: string;
  behalfReason: string;
  assignedTo: string;
}

type SubmitResult = { displayId: string; id: string } | null;

export function NewTicketForm({ categories, isTd }: NewTicketFormProps) {
  const [form, setForm] = useState<FormState>({
    category: '',
    subcategory: '',
    equipmentId: '',
    description: '',
    impact: 'medio',
    openedOnBehalfOf: '',
    behalfReason: '',
    assignedTo: '',
  });
  const [subcategories, setSubcategories] = useState<HelpdeskSubcategorySummary[]>([]);
  const [assignees, setAssignees] = useState<TicketAssignee[]>([]);
  const [openTicketsCount, setOpenTicketsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult>(null);

  useEffect(() => {
    if (!isTd) return;
    fetch('/api/helpdesk/assignees')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TicketAssignee[]) => setAssignees(data))
      .catch(() => {});
  }, [isTd]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCategoryChange(slug: string) {
    set('category', slug);
    set('subcategory', '');
    setSubcategories([]);
    if (!slug) return;
    try {
      const res = await fetch(`/api/helpdesk/categories/${slug}/subcategories`);
      if (res.ok) setSubcategories((await res.json()) as HelpdeskSubcategorySummary[]);
    } catch {
      // ignore
    }
  }

  async function onEmployeeSelect(emp: EmployeeSuggestion) {
    set('openedOnBehalfOf', emp.fullName);
    setOpenTicketsCount(null);
    try {
      const res = await fetch(
        `/api/helpdesk/tickets?status=abierto&search=${encodeURIComponent(emp.fullName)}&limit=5`,
      );
      if (res.ok) {
        const page = (await res.json()) as { data: unknown[] };
        setOpenTicketsCount(page.data?.length ?? 0);
      }
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.description.trim().length < 20) {
      setError('La descripción debe tener al menos 20 caracteres.');
      return;
    }
    if (isTd && form.openedOnBehalfOf && !form.behalfReason.trim()) {
      setError('El motivo de apertura por TD es obligatorio.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createTicketAction({
      category: form.category,
      subcategory: form.subcategory || undefined,
      equipmentId: form.equipmentId || undefined,
      description: form.description,
      impact: form.impact,
      ...(isTd && form.openedOnBehalfOf
        ? { openedByTd: true, openedOnBehalfOf: form.openedOnBehalfOf, behalfReason: form.behalfReason }
        : {}),
      assignedTo: form.assignedTo || undefined,
    });

    setLoading(false);

    if (res.success && res.displayId && res.id) {
      setResult({ displayId: res.displayId, id: res.id });
    } else {
      setError(res.error ?? 'Error al crear el ticket.');
    }
  }

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <i className="ti ti-circle-check text-3xl text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-emerald-800">Ticket creado</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Tu ticket ha sido registrado con el ID{' '}
          <span className="font-mono font-bold">{result.displayId}</span>.
          <br />
          Recibirás actualizaciones por parte del equipo de Soporte TI.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/transformacion/tickets/${result.id}`}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Ver mi ticket
          </Link>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setForm({ category: '', subcategory: '', equipmentId: '', description: '', impact: 'medio', openedOnBehalfOf: '', behalfReason: '', assignedTo: '' });
              setSubcategories([]);
              setOpenTicketsCount(null);
            }}
            className="rounded-md border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Abrir otro ticket
          </button>
        </div>
      </div>
    );
  }

  const placeholder = CATEGORY_PLACEHOLDERS[form.category] ?? 'Describe el problema con el mayor detalle posible…';
  const descLen = form.description.trim().length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sección TD — apertura en nombre de otro colaborador (siempre primero) */}
      {isTd && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Apertura por TD
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Abrir en nombre de
            </label>
            <EmployeeSearch
              value={form.openedOnBehalfOf}
              onSelect={onEmployeeSelect}
              placeholder="Escribe el nombre del colaborador…"
            />
            <p className="mt-1 text-xs text-slate-400">
              Escribe al menos 2 caracteres para buscar.
            </p>
            {form.openedOnBehalfOf && openTicketsCount !== null && openTicketsCount > 0 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <i className="ti ti-alert-triangle text-sm" />
                Este colaborador tiene {openTicketsCount} ticket{openTicketsCount !== 1 ? 's' : ''} abierto{openTicketsCount !== 1 ? 's' : ''}.
              </div>
            )}
          </div>
          {form.openedOnBehalfOf && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Motivo de apertura por TD <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.behalfReason}
                onChange={(e) => set('behalfReason', e.target.value)}
                placeholder="Ej: Colaborador sin acceso al sistema…"
                required={Boolean(form.openedOnBehalfOf)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Categoría */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Categoría <span className="text-red-500">*</span>
        </label>
        <select
          value={form.category}
          onChange={(e) => void onCategoryChange(e.target.value)}
          required
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
        >
          <option value="">Selecciona una categoría…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Subcategoría */}
      {subcategories.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Subcategoría</label>
          <select
            value={form.subcategory}
            onChange={(e) => set('subcategory', e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
          >
            <option value="">Sin especificar</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ID Equipo (siempre opcional) */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          ID del equipo
        </label>
        <input
          type="text"
          value={form.equipmentId}
          onChange={(e) => set('equipmentId', e.target.value)}
          placeholder="Ej: M080, E009…"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
        />
        <p className="mt-1 text-xs text-slate-400">
          Puedes encontrarlo en la etiqueta de tu equipo. Próximamente podrás seleccionarlo desde el inventario.
        </p>
      </div>

      {/* Descripción */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Descripción del problema <span className="text-red-500">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={placeholder}
          rows={5}
          required
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
        />
        <p className={cn('mt-1 text-xs', descLen < 20 ? 'text-slate-400' : 'text-emerald-600')}>
          {descLen}/20 caracteres mínimos
        </p>
      </div>

      {/* Impacto */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Impacto en tu trabajo <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          {(['alto', 'medio', 'bajo'] as TicketImpact[]).map((impact) => (
            <label
              key={impact}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-2.5 text-sm font-medium capitalize transition-colors',
                form.impact === impact
                  ? 'border-black bg-black/5 text-black'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              <input
                type="radio"
                name="impact"
                value={impact}
                checked={form.impact === impact}
                onChange={() => set('impact', impact)}
                className="sr-only"
              />
              {impact === 'alto' ? '🔴 Alto' : impact === 'medio' ? '🟡 Medio' : '🟢 Bajo'}
            </label>
          ))}
        </div>
      </div>

      {/* Asignado a (solo TD) */}
      {isTd && assignees.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asignado a</label>
          <select
            value={form.assignedTo}
            onChange={(e) => set('assignedTo', e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
          >
            <option value="">Sin asignar</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.role ? ` — ${a.role}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || !form.category || descLen < 20}
          className="flex-1 rounded-md bg-black py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? 'Enviando…' : 'Abrir ticket'}
        </button>
        <Link
          href="/transformacion/tickets"
          className="rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
