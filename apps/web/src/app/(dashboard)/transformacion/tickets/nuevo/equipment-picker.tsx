'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EquipmentSearchItem } from '@/lib/api';

interface EquipmentPickerProps {
  /** legacy_id del equipo elegido; '' si no hay ninguno. */
  value: string;
  onChange: (legacyId: string) => void;
}

function label(e: EquipmentSearchItem): string {
  const parts = [e.brand, e.model].filter(Boolean).join(' ');
  return parts || e.type;
}

/**
 * Selector de equipo para el formulario de ticket.
 *
 * Sustituye al input de texto libre, que venía produciendo valores
 * inservibles: espacios al inicio, typos ('MA0O53' por 'MA053'), nombres de
 * sala y hasta la solución del ticket pegada en el campo. Guarda el legacy_id,
 * que es el ID de la etiqueta y con el que se vincula el inventario.
 *
 * Al abrir se precargan los equipos del colaborador: en la mayoría de los
 * tickets el equipo con problema es uno de los suyos, así que la ruta corta es
 * un clic y no una búsqueda.
 */
export function EquipmentPicker({ value, onChange }: EquipmentPickerProps) {
  const [mine, setMine] = useState<EquipmentSearchItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EquipmentSearchItem[]>([]);
  const [selected, setSelected] = useState<EquipmentSearchItem | null>(null);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/inventory/equipment/search?assignedTo=me')
      .then((res) => (res.ok ? (res.json() as Promise<EquipmentSearchItem[]>) : []))
      .then((data) => {
        if (!cancelled) setMine(data);
      })
      .catch(() => {
        if (!cancelled) setMine([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/inventory/equipment/search?q=${encodeURIComponent(q)}`);
      setResults(res.ok ? ((await res.json()) as EquipmentSearchItem[]) : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQuery(q: string) {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void search(q), 250);
  }

  function pick(e: EquipmentSearchItem) {
    setSelected(e);
    setQuery('');
    setResults([]);
    // Se guarda el legacy_id: es el ID impreso en la etiqueta y la llave con la
    // que el inventario encuentra sus tickets. Si el equipo no tiene, se usa el
    // display_id, que la consulta también contempla.
    onChange(e.legacyId ?? e.displayId);
  }

  function clear() {
    setSelected(null);
    setQuery('');
    setResults([]);
    onChange('');
  }

  if (selected || value) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
          <span className="font-mono font-semibold">
            {selected?.legacyId ?? selected?.displayId ?? value}
          </span>
          {selected && <span className="text-slate-500">— {label(selected)}</span>}
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
    <div className="space-y-2">
      {mine.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mine.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => pick(e)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-black hover:bg-slate-50"
            >
              <span className="font-mono font-semibold">{e.legacyId ?? e.displayId}</span>
              <span className="ml-1 text-slate-500">{label(e)}</span>
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => handleQuery(e.target.value)}
        placeholder="Buscar por ID, marca o modelo…"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-black focus:outline-none"
      />

      {searching && <p className="text-xs text-slate-400">Buscando…</p>}

      {results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => pick(e)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-mono text-xs font-semibold text-slate-700">
                  {e.legacyId ?? e.displayId}
                </span>
                <span className="text-slate-600">{label(e)}</span>
                <span className="ml-auto text-xs text-slate-400">{e.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-xs text-slate-400">Sin resultados para &quot;{query.trim()}&quot;.</p>
      )}

      <button
        type="button"
        onClick={clear}
        className="text-xs text-slate-400 underline hover:text-slate-600"
      >
        No sé / No aplica
      </button>
    </div>
  );
}
