'use client';

import { useCallback, useRef, useState } from 'react';
import { avatarColor, initials } from '@/lib/avatar';

export interface EmployeePickerValue {
  id: string;
  fullName: string;
  position: string;
  area: string | null;
  location: string | null;
  corporateEmail: string | null;
}

interface EmployeePickerProps {
  label: string;
  value: EmployeePickerValue | null;
  onSelect: (emp: EmployeePickerValue | null) => void;
  id?: string;
}

function EmployeeAvatar({ email, name }: { email: string | null; name: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);

  if (email && !photoFailed) {
    return (
      <img
        src={`/api/users/${encodeURIComponent(email)}/photo`}
        alt={name}
        className="h-7 w-7 rounded-full object-cover"
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor(name)}`}
    >
      {initials(name)}
    </span>
  );
}

export function EmployeePicker({ label, value, onSelect, id }: EmployeePickerProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<EmployeePickerValue[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const page = (await res.json()) as { data: EmployeePickerValue[] };
        setSuggestions(page.data ?? []);
        setOpen(true);
      }
    } catch { /* noop */ }
  }, []);

  function handleChange(v: string) {
    setQuery(v);
    if (value) { onSelect(null); }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 300);
  }

  function handleSelect(emp: EmployeePickerValue) {
    setQuery(emp.fullName);
    setSuggestions([]);
    setOpen(false);
    onSelect(emp);
  }

  function handleClear() {
    setQuery('');
    onSelect(null);
    setSuggestions([]);
    setOpen(false);
  }

  const inputClass =
    'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-navy focus:border-terracota focus:outline-none focus:ring-1 focus:ring-terracota';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={id}>
        {label}
      </label>

      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
          <EmployeeAvatar email={value.corporateEmail} name={value.fullName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy">{value.fullName}</p>
            <p className="truncate text-xs text-slate-400">{value.position}</p>
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
            placeholder="Buscar empleado…"
            className={inputClass}
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
              {suggestions.map((emp) => (
                <li
                  key={emp.id}
                  onMouseDown={() => handleSelect(emp)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50"
                >
                  <EmployeeAvatar email={emp.corporateEmail} name={emp.fullName} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">{emp.fullName}</p>
                    <p className="truncate text-xs text-slate-400">{emp.position}{emp.area ? ` · ${emp.area}` : ''}</p>
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
