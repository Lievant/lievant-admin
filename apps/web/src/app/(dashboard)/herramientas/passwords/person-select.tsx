'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PasswordVisiblePerson } from '@/lib/api';

/** Sin mayúsculas ni acentos: "claudia vazquez" encuentra "Claudia Vázquez". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function labelOf(person: PasswordVisiblePerson): string {
  return person.isMe ? `Yo (${person.fullName})` : person.fullName;
}

/**
 * Lista desplegable con búsqueda de las personas cuya información se puede ver:
 * la propia y sus subordinados directos. Con una sola persona no hay nada que
 * elegir y se muestra solo el nombre.
 */
export function PersonSelect({
  people,
  value,
  onChange,
  disabled,
}: {
  people: PasswordVisiblePerson[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = people.find((p) => p.id === value) ?? people[0];
  const filtered = useMemo(() => {
    const term = normalize(query);
    return term ? people.filter((p) => normalize(p.fullName).includes(term)) : people;
  }, [people, query]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  if (!selected) return null;

  if (people.length === 1) {
    return <p className="text-sm font-medium text-navy">{selected.fullName}</p>;
  }

  function close(returnFocus = false) {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(person: PasswordVisiblePerson) {
    onChange(person.id);
    close(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const person = filtered[active];
      if (person) {
        e.preventDefault();
        choose(person);
      }
    }
  }

  return (
    <div ref={wrapper} className="relative w-full max-w-sm" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-60"
      >
        <span className="truncate">{labelOf(selected)}</span>
        <span aria-hidden="true" className="text-xs text-slate-400">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Buscar por nombre…"
              aria-label="Buscar persona"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-navy placeholder:text-slate-400 focus:border-black focus:outline-none"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Personas" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>
            ) : (
              filtered.map((p, i) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={p.id === selected.id}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(p);
                  }}
                  className={`cursor-pointer px-3 py-2 text-sm text-navy ${i === active ? 'bg-slate-100' : ''} ${
                    p.id === selected.id ? 'font-semibold' : ''
                  }`}
                >
                  {labelOf(p)}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
