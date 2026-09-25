'use client';

import { useState } from 'react';
import type { EquipmentBrandItem } from '@/lib/api';

const OTHER = '__other__';

interface BrandSelectProps {
  brands: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Select de marcas desde el catálogo, con una opción "Otra…" al final que
 * revela un input de texto libre para marcas no listadas.
 *
 * Al salir del input se buscan marcas parecidas y se sugiere la existente: el
 * catálogo venía acumulando variantes de lo mismo ('Generico'/'GENERICO',
 * 'Sony'/'SONY') porque cada quien escribía a su manera. El API además resuelve
 * sin distinguir mayúsculas al guardar, así que esto es la primera barrera, no
 * la única.
 */
export function BrandSelect({ brands, value, onChange, className }: BrandSelectProps) {
  const knownNames = brands.map((b) => b.name);
  // Modo texto libre si el valor actual no está en el catálogo (marca custom o
  // desactivada) o si el usuario eligió explícitamente "Otra".
  const [custom, setCustom] = useState(value !== '' && !knownNames.includes(value));
  const [suggestions, setSuggestions] = useState<EquipmentBrandItem[]>([]);
  const [checked, setChecked] = useState(false);

  function handleSelect(v: string) {
    setSuggestions([]);
    setChecked(false);
    if (v === OTHER) {
      setCustom(true);
      onChange('');
    } else {
      setCustom(false);
      onChange(v);
    }
  }

  async function checkSimilar() {
    const term = value.trim();
    setChecked(false);
    setSuggestions([]);
    if (term.length < 2) return;

    try {
      const res = await fetch(`/api/inventory/brands?search=${encodeURIComponent(term)}`);
      if (!res.ok) return;
      const found = (await res.json()) as EquipmentBrandItem[];
      // Una coincidencia exacta sin distinguir mayúsculas no es una sugerencia:
      // es la misma marca, y el API la va a reutilizar tal cual.
      const exact = found.find((b) => b.name.toLowerCase() === term.toLowerCase());
      if (exact) {
        onChange(exact.name);
        setSuggestions([]);
      } else {
        setSuggestions(found.slice(0, 3));
      }
      setChecked(true);
    } catch {
      /* Si la búsqueda falla se guarda igual: el API deduplica al guardar. */
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={custom ? OTHER : value}
        onChange={(e) => handleSelect(e.target.value)}
        className={className}
      >
        <option value="">Seleccionar…</option>
        {brands.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
        <option value={OTHER}>Otra…</option>
      </select>

      {custom && (
        <>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setChecked(false);
              setSuggestions([]);
            }}
            onBlur={checkSimilar}
            placeholder="Escribe la marca…"
            autoFocus
            className={className}
          />

          {suggestions.length > 0 && (
            <p className="text-xs text-amber-700">
              ¿Quisiste decir{' '}
              {suggestions.map((b, i) => (
                <span key={b.id}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    onClick={() => {
                      onChange(b.name);
                      setCustom(false);
                      setSuggestions([]);
                    }}
                    className="font-semibold underline hover:opacity-80"
                  >
                    {b.name}
                  </button>
                </span>
              ))}
              ?
            </p>
          )}

          {checked && suggestions.length === 0 && value.trim().length >= 2 && (
            <p className="text-xs text-slate-400">
              &quot;{value.trim()}&quot; se agregará al catálogo de marcas al guardar.
            </p>
          )}
        </>
      )}
    </div>
  );
}
