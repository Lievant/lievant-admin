'use client';

import { useState } from 'react';

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
 */
export function BrandSelect({ brands, value, onChange, className }: BrandSelectProps) {
  const knownNames = brands.map((b) => b.name);
  // Modo texto libre si el valor actual no está en el catálogo (marca custom o
  // desactivada) o si el usuario eligió explícitamente "Otra".
  const [custom, setCustom] = useState(value !== '' && !knownNames.includes(value));

  function handleSelect(v: string) {
    if (v === OTHER) {
      setCustom(true);
      onChange('');
    } else {
      setCustom(false);
      onChange(v);
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
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe la marca…"
          autoFocus
          className={className}
        />
      )}
    </div>
  );
}
