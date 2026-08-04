'use client';

import { useCallback, useRef, useState } from 'react';
import { avatarColor, initials } from '@/lib/avatar';

export interface ClientPickerValue {
  id: string;
  name: string;
  displayId: string;
}

interface ClientPickerProps {
  label: string;
  value: ClientPickerValue | null;
  onSelect: (client: ClientPickerValue | null) => void;
  id?: string;
}

interface ClientApiItem {
  id: string;
  displayId: string;
  primaryCompany: { name: string } | null;
}

export function ClientPicker({ label, value, onSelect, id }: ClientPickerProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ClientPickerValue[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const page = (await res.json()) as { data: ClientApiItem[] };
        setSuggestions(
          (page.data ?? []).map((c) => ({
            id: c.id,
            name: c.primaryCompany?.name ?? c.displayId,
            displayId: c.displayId,
          })),
        );
        setOpen(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    if (value) onSelect(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(client: ClientPickerValue) {
    setQuery(client.name);
    setSuggestions([]);
    setOpen(false);
    onSelect(client);
  }

  function handleClear() {
    setQuery('');
    onSelect(null);
    setSuggestions([]);
    setOpen(false);
  }

  const inputClass =
    'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={id}>
        {label}
      </label>

      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(value.name)}`}
          >
            {initials(value.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy">{value.name}</p>
            <p className="truncate text-xs text-slate-400">{value.displayId}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Quitar selección"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id={id}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar cliente…"
            className={inputClass}
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
              {suggestions.map((client) => (
                <li
                  key={client.id}
                  onMouseDown={() => handleSelect(client)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(client.name)}`}
                  >
                    {initials(client.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{client.name}</p>
                    <p className="truncate text-xs text-slate-400">{client.displayId}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
