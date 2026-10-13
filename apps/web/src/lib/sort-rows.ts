export type SortDir = 'asc' | 'desc';

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/**
 * Orden genérico para tablas del cliente. `getValue` devuelve el valor
 * comparable de la fila (texto, número o null); no modifica el arreglo original.
 *
 * - Texto: sin distinguir mayúsculas ni acentos, con orden natural en español.
 * - Número: por su valor real (también fechas, como marca de tiempo).
 * - Vacíos (null o texto en blanco) siempre al final, en ambos sentidos.
 * - Estable: los empates conservan su orden relativo.
 */
export function sortRows<T>(
  rows: T[],
  getValue: (row: T) => string | number | null,
  dir: SortDir,
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => {
      const raw = getValue(row);
      const value = typeof raw === 'string' ? raw.trim() || null : raw;
      return { row, index, value };
    })
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      const cmp =
        typeof a.value === 'number' && typeof b.value === 'number'
          ? a.value - b.value
          : collator.compare(String(a.value), String(b.value));
      return cmp !== 0 ? cmp * sign : a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Clic en un encabezado: la columna nueva arranca ascendente; la misma alterna. */
export function nextSort<K extends string>(
  current: { key: K; dir: SortDir } | null,
  key: K,
): { key: K; dir: SortDir } {
  return current?.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}
