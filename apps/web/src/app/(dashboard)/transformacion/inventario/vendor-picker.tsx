'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VendorSearchItem } from '@/lib/api';

interface VendorPickerProps {
  /** UUID del proveedor elegido; '' si no hay. */
  value: string;
  /** Nombre a mostrar cuando el valor viene precargado desde el servidor. */
  initialName?: string | null;
  onChange: (vendorId: string, vendor: VendorSearchItem | null) => void;
}

/**
 * Buscador de proveedor contra el padrón, con la misma mecánica que
 * EmployeePicker: escribir, esperar el debounce y elegir de la lista. Guarda el
 * UUID —no el nombre— porque la garantía se reclama contra un proveedor
 * concreto y el texto libre ya nos costó 23 variantes en el catálogo de marcas.
 */
export function VendorPicker({ value, initialName, onChange }: VendorPickerProps) {
  const [selected, setSelected] = useState<VendorSearchItem | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VendorSearchItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al editar un equipo llega el id ya guardado: se muestra el nombre que el
  // servidor resolvió, sin pedir la búsqueda otra vez.
  useEffect(() => {
    if (value && initialName && !selected) {
      setSelected({ id: value, name: initialName, rfc: '' });
    }
  }, [value, initialName, selected]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/search?q=${encodeURIComponent(q)}`);
      const data = res.ok ? ((await res.json()) as VendorSearchItem[]) : [];
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQuery(q: string) {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void search(q), 250);
  }

  function pick(v: VendorSearchItem) {
    setSelected(v);
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(v.id, v);
  }

  function clear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange('', null);
  }

  if (selected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
          <span className="font-medium">{selected.name}</span>
          {selected.rfc && <span className="font-mono text-xs text-slate-500">{selected.rfc}</span>}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-semibold text-slate-500 underline hover:text-slate-700"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQuery(e.target.value)}
        placeholder="Buscar proveedor por nombre o RFC…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
      />

      {loading && <p className="mt-1 text-xs text-slate-400">Buscando…</p>}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {results.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => pick(v)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="text-sm text-slate-700">{v.name}</span>
                <span className="font-mono text-xs text-slate-400">{v.rfc}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <p className="mt-1 text-xs text-slate-400">Sin proveedores que coincidan.</p>
      )}
    </div>
  );
}
