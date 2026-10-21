export type SortDir = 'asc' | 'desc';

const baseCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/**
 * Orden por columna de `useSortableColumns`.
 *
 * Por omisión es el de siempre: el valor como texto con `localeCompare('es',
 * { numeric: true })`, y el vacío cuenta como texto vacío. Las columnas de
 * `emptyLastKeys` ordenan además sin distinguir acentos ni mayúsculas y dejan
 * los vacíos siempre al final, en ambos sentidos (p. ej. tickets sin asignar).
 * El orden es estable.
 */
export function sortByColumn<T>(
  items: T[],
  key: string,
  dir: SortDir,
  emptyLastKeys: readonly string[] = [],
): T[] {
  const read = (item: T) => (item as Record<string, unknown>)[key];

  if (!emptyLastKeys.includes(key)) {
    return [...items].sort((a, b) => {
      const cmp = String(read(a) ?? '').localeCompare(String(read(b) ?? ''), 'es', { numeric: true });
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  return items
    .map((item, index) => ({ item, index, value: read(item) }))
    .sort((a, b) => {
      const ea = isEmpty(a.value);
      const eb = isEmpty(b.value);
      if (ea || eb) return ea && eb ? a.index - b.index : ea ? 1 : -1;
      const cmp = baseCollator.compare(String(a.value), String(b.value));
      return cmp !== 0 ? (dir === 'asc' ? cmp : -cmp) : a.index - b.index;
    })
    .map(({ item }) => item);
}
