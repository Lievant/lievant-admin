'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { filterOptions, selectedInOrder, type MultiSelectOption } from './multi-select-utils';

export type { MultiSelectOption };

const INPUT =
  'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-black focus:outline-none focus:ring-1 focus:ring-black';

/**
 * Selector múltiple con búsqueda (combobox accesible): se escribe para filtrar, se elige con clic o con Enter, y las
 * elegidas quedan como chips que se quitan con su «×». Las opciones inactivas solo aparecen como chips (marcadas como
 * inactivas) cuando ya estaban elegidas: no se pueden volver a elegir.
 */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  maxItems,
  placeholder = 'Busca y elige…',
  invalid = false,
  disabled = false,
  loading = false,
  describedBy,
}: {
  id: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  maxItems?: number;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  loading?: boolean;
  describedBy?: string | undefined;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const hits = filterOptions(options, value, query);
  const chips = selectedInOrder(options, value);
  const full = maxItems !== undefined && value.length >= maxItems;
  const listId = `${id}-list`;

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // Al abrir (o al filtrar) la lista se acerca a la vista, aunque el campo esté dentro de un cuerpo con scroll.
  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: 'nearest' });
  }, [open, query, value.length]);

  const add = (optionId: string) => {
    if (full || value.includes(optionId)) return;
    onChange([...value, optionId]);
    setQuery('');
    setActive(0);
  };
  const remove = (optionId: string) => onChange(value.filter((v) => v !== optionId));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      // Enter elige la opción resaltada y nunca envía el formulario desde aquí.
      e.preventDefault();
      const hit = hits[active];
      if (open && hit) add(hit.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      remove(value[value.length - 1]!);
    }
  };

  return (
    <div ref={root} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={loading ? 'Cargando…' : full ? `Máximo ${maxItems}` : placeholder}
        className={cn(INPUT, invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500')}
      />
      {open && (
        <ul ref={list} id={listId} role="listbox" aria-multiselectable="true" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {full ? (
            <li className="px-3 py-2 text-xs text-slate-500">Ya llegaste al máximo de {maxItems}. Quita alguna para elegir otra.</li>
          ) : loading ? (
            <li className="px-3 py-2 text-xs text-slate-500">Cargando…</li>
          ) : hits.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">{query.trim() ? 'Sin coincidencias' : 'No hay más opciones'}</li>
          ) : (
            hits.map((o, i) => (
              <li key={o.id} role="option" aria-selected={false} id={`${id}-opt-${i}`}>
                <button
                  type="button"
                  tabIndex={-1}
                  // mousedown evita que el campo pierda el foco antes del clic.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(o.id)}
                  className={cn('block w-full px-3 py-2 text-left text-sm text-navy hover:bg-slate-50', i === active && 'bg-slate-100')}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {chips.length > 0 && (
        <ul className="mt-2 flex max-h-36 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain rounded-md border border-slate-100 p-1.5" aria-label="Elegidas">
          {chips.map((c) => (
            <li key={c.id} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', c.inactive ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-navy')}>
              <span className="break-words">{c.label}{c.inactive ? ' (Inactiva)' : ''}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(c.id)}
                aria-label={`Quitar ${c.label}`}
                className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-navy"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
