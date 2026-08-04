'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { EquipmentBrandCatalog, EquipmentStatusCatalog, EquipmentTypeCatalog } from '@/lib/api';
import { BrandSelect } from '../brand-select';

interface EmployeeSuggestion {
  id: string;
  fullName: string;
  position: string;
  area: string | null;
  location: string | null;
}

function EmployeeSearch({ onSelect }: { onSelect: (emp: EmployeeSuggestion | null) => void }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EmployeeSuggestion | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const page = (await res.json()) as { data: EmployeeSuggestion[] };
        setSuggestions(page.data ?? []);
        setOpen(true);
      }
    } catch { /* noop */ }
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    if (selected) { setSelected(null); onSelect(null); }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(emp: EmployeeSuggestion) {
    setSelected(emp);
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
        placeholder="Buscar empleado por nombre o email…"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((emp) => (
            <li
              key={emp.id}
              onMouseDown={() => handleSelect(emp)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-navy">{emp.fullName}</span>
              <span className="ml-2 text-slate-500">{emp.position}</span>
              {emp.area && <span className="ml-1 text-slate-400">· {emp.area}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface NewEquipmentFormProps {
  types: EquipmentTypeCatalog[];
  brands: EquipmentBrandCatalog[];
  statuses: EquipmentStatusCatalog[];
}

export function NewEquipmentForm({ types, brands, statuses }: NewEquipmentFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedEmployee, setAssignedEmployee] = useState<EmployeeSuggestion | null>(null);

  const [form, setForm] = useState({
    equipmentType: '',
    legacyId: '',
    brand: '',
    model: '',
    serialNumber: '',
    operatingSystem: '',
    adName: '',
    specifications: '',
    responsiva: '',
    chargerIncluded: false,
    status: 'Disponible',
    location: '',
    area: '',
    purchaseDate: '',
    purchaseValue: '',
    notes: '',
    assignmentDate: '',
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEmployeeSelect(emp: EmployeeSuggestion | null) {
    setAssignedEmployee(emp);
    if (emp) {
      set('status', 'Asignado');
      if (emp.area) set('area', emp.area);
      if (emp.location) set('location', emp.location);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipmentType) { setError('El tipo de equipo es requerido'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        equipmentType: form.equipmentType,
        legacyId: form.legacyId || undefined,
        brand: form.brand || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        operatingSystem: form.operatingSystem || undefined,
        adName: form.adName || undefined,
        specifications: form.specifications || undefined,
        assignedToEmployeeId: assignedEmployee?.id,
        assignmentDate: form.assignmentDate || undefined,
        responsiva: form.responsiva || undefined,
        chargerIncluded: form.chargerIncluded,
        status: form.status || undefined,
        location: form.location || undefined,
        area: form.area || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchaseValue: form.purchaseValue ? parseFloat(form.purchaseValue) : undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch('/api/inventory/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string };
        throw new Error(body.message ?? 'Error al crear el equipo');
      }
      const created = (await res.json()) as { id: string };
      router.push(`/transformacion/inventario/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setSaving(false);
    }
  }

  const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-black focus:outline-none';
  const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-black/30 bg-black/5 px-4 py-3 text-sm text-black">
          {error}
        </div>
      )}

      {/* Clasificación */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-navy">Clasificación</legend>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tipo de equipo *</label>
            <select required value={form.equipmentType} onChange={(e) => set('equipmentType', e.target.value)} className={inputClass}>
              <option value="">Seleccionar…</option>
              {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Marca</label>
            <BrandSelect brands={brands} value={form.brand} onChange={(v) => set('brand', v)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Modelo</label>
            <input type="text" value={form.model} onChange={(e) => set('model', e.target.value)} className={inputClass} placeholder="Ej: ThinkPad X1 Carbon" />
          </div>
          <div>
            <label className={labelClass}>No. de serie</label>
            <input type="text" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sistema operativo</label>
            <input type="text" value={form.operatingSystem} onChange={(e) => set('operatingSystem', e.target.value)} className={inputClass} placeholder="WIN11 PRO, MacOS, Android…" />
          </div>
          <div>
            <label className={labelClass}>ID Legado</label>
            <input type="text" value={form.legacyId} onChange={(e) => set('legacyId', e.target.value)} className={inputClass} placeholder="AD046, M092…" />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Nombre en Active Directory</label>
          <input type="text" value={form.adName} onChange={(e) => set('adName', e.target.value)} className={inputClass} />
        </div>
        <div className="mt-4">
          <label className={labelClass}>Especificaciones</label>
          <textarea value={form.specifications} onChange={(e) => set('specifications', e.target.value)} rows={2} className={inputClass} placeholder="RAM, procesador, disco…" />
        </div>
      </fieldset>

      {/* Asignación */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-navy">Asignación</legend>
        <div className="mt-3 space-y-4">
          <div>
            <label className={labelClass}>Asignado a (opcional)</label>
            <EmployeeSearch onSelect={handleEmployeeSelect} />
          </div>
          {assignedEmployee && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Fecha de asignación</label>
                <input type="date" value={form.assignmentDate} onChange={(e) => set('assignmentDate', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>No. de responsiva</label>
                <input type="text" value={form.responsiva} onChange={(e) => set('responsiva', e.target.value)} className={inputClass} placeholder="TIC-RE-02-XXXX" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Estatus</label>
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                {statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="charger" checked={form.chargerIncluded} onChange={(e) => set('chargerIncluded', e.target.checked)} className="h-4 w-4" />
              <label htmlFor="charger" className="text-sm text-slate-700">Cargador incluido</label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ubicación</label>
              <select value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass}>
                <option value="">Seleccionar…</option>
                {['León', 'Ciudad de México', 'Guadalajara', 'Medellín', 'Charlotte'].map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Área</label>
              <input type="text" value={form.area} onChange={(e) => set('area', e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Financiero */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-navy">Financiero</legend>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha de compra</label>
            <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Valor del equipo (MXN)</label>
            <input type="number" min="0" step="0.01" value={form.purchaseValue} onChange={(e) => set('purchaseValue', e.target.value)} className={inputClass} placeholder="0.00" />
          </div>
        </div>
      </fieldset>

      {/* Notas */}
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-navy">Notas TI</legend>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={`mt-3 ${inputClass}`} />
      </fieldset>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black px-6 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar equipo'}
        </button>
        <Link href="/transformacion/inventario" className="rounded-md border border-slate-200 px-6 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
