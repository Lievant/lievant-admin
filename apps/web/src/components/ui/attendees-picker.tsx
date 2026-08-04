'use client';

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BookingAttendee } from '@/lib/api';

interface EmployeeSuggestion {
  id: string;
  fullName: string;
  corporateEmail: string | null;
}

interface AttendeesPickerProps {
  label?: string;
  value: BookingAttendee[];
  onChange: (attendees: BookingAttendee[]) => void;
  id?: string;
}

/** Handle imperativo para hacer flush del email pendiente en el input al enviar el formulario. */
export interface AttendeePickerHandle {
  /**
   * Si hay un email válido escrito pero no confirmado, lo agrega a la lista y limpia el input.
   * Devuelve SIEMPRE la lista final de invitados (síncrona, no depende de setState) para que el
   * formulario la use directo en el payload. Si el texto pendiente no es un email válido, lo
   * ignora y marca el input en rojo.
   */
  commitPending: () => BookingAttendee[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AttendeesPicker = forwardRef<AttendeePickerHandle, AttendeesPickerProps>(function AttendeesPicker(
  { label = 'Invitados', value, onChange, id },
  ref,
) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    commitPending: () => {
      const raw = query.replace(/,$/, '').trim().toLowerCase();
      if (!raw) return value;
      if (!EMAIL_RE.test(raw)) {
        setError('Email inválido.');
        return value; // texto no-email → se ignora, se conserva la lista actual
      }
      if (value.some((a) => a.email.toLowerCase() === raw)) {
        setQuery('');
        return value; // ya estaba agregado
      }
      const next: BookingAttendee[] = [...value, { email: raw }];
      onChange(next);
      setQuery('');
      setError(null);
      setSuggestions([]);
      setOpen(false);
      return next;
    },
  }));

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/employees/search-for-assignment?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = (await res.json()) as EmployeeSuggestion[];
        setSuggestions(Array.isArray(data) ? data.filter((e) => e.corporateEmail) : []);
        setOpen(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  function addAttendee(attendee: BookingAttendee) {
    const email = attendee.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError('Email inválido.');
      return;
    }
    if (value.some((a) => a.email.toLowerCase() === email)) {
      setError('Ese invitado ya fue agregado.');
      return;
    }
    setError(null);
    const next: BookingAttendee = { email };
    if (attendee.name) next.name = attendee.name;
    onChange([...value, next]);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
  }

  function removeAttendee(email: string) {
    onChange(value.filter((a) => a.email.toLowerCase() !== email.toLowerCase()));
  }

  function handleChange(v: string) {
    setError(null);
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const raw = query.replace(/,$/, '').trim();
      if (raw) addAttendee({ email: raw });
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      const last = value[value.length - 1];
      if (last) removeAttendee(last.email);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={id}>
        {label}
      </label>

      {value.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1.5">
          {value.map((a) => (
            <span
              key={a.email}
              className="inline-flex items-center gap-1 rounded-full bg-black/10 py-0.5 pl-2 pr-1 text-xs font-medium text-black"
              title={a.email}
            >
              {a.name ?? a.email}
              <button
                type="button"
                onClick={() => removeAttendee(a.email)}
                className="ml-0.5 rounded-full px-1 text-black/70 hover:bg-black/20 hover:text-black"
                aria-label={`Quitar ${a.email}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar por nombre o escribir email…"
          className={cn(
            'w-full rounded-md border px-3 py-2 text-sm text-navy focus:outline-none focus:ring-1',
            error
              ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
              : 'border-slate-200 focus:border-black focus:ring-black',
          )}
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {suggestions.map((emp) => (
              <li
                key={emp.id}
                onMouseDown={() => addAttendee({ email: emp.corporateEmail as string, name: emp.fullName })}
                className="flex cursor-pointer flex-col px-3 py-2 hover:bg-slate-50"
              >
                <span className="text-sm font-medium text-navy">{emp.fullName}</span>
                <span className="text-xs text-slate-400">{emp.corporateEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      <p className="text-xs text-slate-400">
        Escribe un nombre para buscar colaboradores, o un email externo y presiona Enter.
      </p>
    </div>
  );
});
