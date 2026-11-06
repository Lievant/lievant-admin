'use client';

import { useEffect, useRef, useState } from 'react';
import type { PositionRef } from './positions-constants';

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const MIN_CHARS = 2;
const WAIT_MS = 300;

/**
 * Buscador de puestos activos de la Matriz (nunca el propio ni los ya elegidos). Se escribe (mínimo 2 letras, con espera
 * breve) y se elige con clic; `onPick` recibe el puesto elegido.
 */
export function PositionSearch({ id, excludeIds, onPick, placeholder }: { id: string; excludeIds: string[]; onPick: (p: PositionRef) => void; placeholder: string }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PositionRef[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const text = query.trim();
    const ticket = ++latest.current;
    if (text.length < MIN_CHARS) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hr/job-positions?search=${encodeURIComponent(text)}&status=activo&limit=15&sortBy=title&sortDir=asc`);
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { data?: PositionRef[] };
        if (ticket !== latest.current) return;
        setHits(Array.isArray(body.data) ? body.data : []);
        setFailed(false);
        setOpen(true);
      } catch {
        if (ticket === latest.current) {
          setHits([]);
          setFailed(true);
          setOpen(true);
        }
      } finally {
        if (ticket === latest.current) setLoading(false);
      }
    }, WAIT_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const visible = hits.filter((h) => !excludeIds.includes(h.id));
  return (
    <div ref={box} className="relative">
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={INPUT}
      />
      {query.trim().length > 0 && query.trim().length < MIN_CHARS && <p className="mt-1 text-xs text-slate-400">Escribe al menos {MIN_CHARS} letras.</p>}
      {loading && <p className="mt-1 text-xs text-slate-400">Buscando…</p>}
      {open && !loading && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {failed ? (
            <li className="px-3 py-2 text-xs text-red-600">No se pudo buscar. Intenta de nuevo.</li>
          ) : visible.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">Sin coincidencias</li>
          ) : (
            visible.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(h);
                    setQuery('');
                    setHits([]);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-navy">{h.title}</span>
                  <span className="block text-xs text-slate-500">{[h.code, h.area].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
