'use client';

import { useEffect, useRef, useState } from 'react';
import { reportsToLabel, type ReportsToValue } from './positions-constants';

export type { ReportsToValue };

interface Hit {
  id: string;
  fullName: string;
  position: string;
  area: string | null;
}

const INPUT = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';
const MIN_CHARS = 2;
const WAIT_MS = 300;

/**
 * Buscador de empleados activos para «Reporta a»: se escribe (mínimo 2 letras, con espera breve) y se elige uno;
 * queda ligado al puesto y se puede quitar. Solo trae id, nombre, cargo y área.
 */
export function ReportsToPicker({ id, value, onChange }: { id: string; value: ReportsToValue | null; onChange: (v: ReportsToValue | null) => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Solo cuenta la respuesta de la búsqueda más reciente.
  const latest = useRef(0);

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
        const res = await fetch(`/api/hr/job-positions/employee-search?q=${encodeURIComponent(text)}&limit=10`);
        if (!res.ok) throw new Error();
        const rows = (await res.json()) as Hit[];
        if (ticket !== latest.current) return;
        setHits(Array.isArray(rows) ? rows : []);
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

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy">
        <span id={id} className="min-w-0 truncate">{reportsToLabel(value)}</span>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 text-xs font-medium text-red-600 hover:underline">Quitar</button>
      </div>
    );
  }

  return (
    <div className="relative">
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
        placeholder="Escribe el nombre del jefe…"
        className={INPUT}
      />
      {query.trim().length > 0 && query.trim().length < MIN_CHARS && <p className="mt-1 text-xs text-slate-400">Escribe al menos {MIN_CHARS} letras.</p>}
      {loading && <p className="mt-1 text-xs text-slate-400">Buscando…</p>}
      {open && !loading && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {failed ? (
            <li className="px-3 py-2 text-xs text-red-600">No se pudo buscar. Intenta de nuevo.</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">Sin coincidencias</li>
          ) : (
            hits.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ id: h.id, fullName: h.fullName, position: h.position, active: true });
                    setQuery('');
                    setHits([]);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="block text-sm font-medium text-navy">{h.fullName}</span>
                  <span className="block text-xs text-slate-500">{[h.position, h.area].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
