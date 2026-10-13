'use client';

import { useEffect, useId, useRef, useState } from 'react';

export interface OwnerValue {
  id: string;
  name: string;
  /** El dueño actual de un riesgo existente ya no está activo. */
  inactive?: boolean;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

/**
 * Autocompletado de dueño: filtra usuarios activos por nombre mientras se
 * escribe (el servidor ignora mayúsculas y acentos). Teclado: flechas, Enter
 * para elegir y Escape para cerrar. Al elegir se muestra la persona con un botón
 * para quitarla.
 */
export function OwnerPicker({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: OwnerValue | null;
  onChange: (value: OwnerValue | null) => void;
  disabled: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const requestSeq = useRef(0);
  const wrapper = useRef<HTMLDivElement>(null);

  // Búsqueda con retardo; las respuestas viejas se descartan.
  useEffect(() => {
    if (value) return;
    const term = query.trim();
    if (term.length < MIN_CHARS) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/risks/owner-candidates?q=${encodeURIComponent(term)}`);
        if (seq !== requestSeq.current) return;
        if (!res.ok) throw new Error();
        const rows = (await res.json()) as Candidate[];
        setResults(Array.isArray(rows) ? rows : []);
        setFailed(false);
        setActive(0);
      } catch {
        if (seq !== requestSeq.current) return;
        setResults([]);
        setFailed(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, value]);

  // Clic fuera cierra la lista.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function select(candidate: Candidate) {
    onChange({ id: candidate.id, name: candidate.name });
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery('');
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const candidate = results[active];
      if (open && candidate) {
        e.preventDefault();
        select(candidate);
      }
    } else if (e.key === 'Escape' && open) {
      // Cierra la lista sin cerrar el modal que contiene el campo.
      e.stopPropagation();
      setOpen(false);
    }
  }

  const labelClass = 'mb-1 block text-xs font-medium text-slate-500';
  const term = query.trim();
  const showPanel = open && !value && term.length >= MIN_CHARS;

  return (
    <div ref={wrapper} className="relative">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <p className="min-w-0 truncate text-sm text-navy">
            {value.name}
            {value.inactive && <span className="ml-1 text-xs text-amber-600">(inactivo)</span>}
          </p>
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="shrink-0 text-slate-400 hover:text-slate-600 disabled:opacity-60"
            aria-label="Quitar dueño"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={query}
          disabled={disabled}
          placeholder="Escribe el nombre de la persona…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy placeholder:text-slate-400 focus:border-navy focus:outline-none disabled:opacity-60"
        />
      )}

      {showPanel && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate-400">Buscando…</li>
          ) : failed ? (
            <li className="px-3 py-2 text-sm text-rose-600">No se pudo buscar. Intenta de nuevo.</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                // mousedown y no click: el blur del input cerraría la lista antes del click.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(c);
                }}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <p className="truncate text-sm font-medium text-navy">{c.name}</p>
                <p className="truncate text-xs text-slate-400">{c.email}</p>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
