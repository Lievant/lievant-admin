/**
 * Orden de la lista de la Matriz de Puestos (sin React): columnas ordenables, lectura y escritura del orden en la
 * URL (`sortBy` y `sortDir`) y su parte del query del API. El orden en sí se aplica en el servidor.
 */
import type { SortDir } from '@/lib/sort-rows';

/** Mismas claves que acepta el API (lista cerrada). */
export const SORT_COLUMNS = [
  { key: 'code', label: 'Código' },
  { key: 'title', label: 'Puesto' },
  { key: 'division', label: 'División' },
  { key: 'area', label: 'Área' },
  { key: 'level', label: 'Nivel' },
  { key: 'seniority', label: 'Categoría' },
  { key: 'plazas', label: 'Plazas' },
  { key: 'validationStatus', label: 'Validación' },
  { key: 'status', label: 'Estado' },
] as const;

export type PositionSortKey = (typeof SORT_COLUMNS)[number]['key'];
export interface PositionSort {
  key: PositionSortKey;
  dir: SortDir;
}

const KEYS: readonly string[] = SORT_COLUMNS.map((c) => c.key);

const first = (v: string | string[] | undefined | null): string | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

/** Orden de la URL; un valor inválido se ignora (la lista queda en su orden original). */
export function parseSort(params: Record<string, string | string[] | undefined> | URLSearchParams): PositionSort | null {
  const get = (k: string) => first(params instanceof URLSearchParams ? params.get(k) : params[k]);
  const key = get('sortBy');
  if (!key || !KEYS.includes(key)) return null;
  const dir = get('sortDir');
  return { key: key as PositionSortKey, dir: dir === 'desc' ? 'desc' : 'asc' };
}

/** `sortBy=level&sortDir=desc` o '' si no hay orden. */
export function sortQuery(sort: PositionSort | null): string {
  return sort ? new URLSearchParams({ sortBy: sort.key, sortDir: sort.dir }).toString() : '';
}

/** Añade el orden a los parámetros del API. */
export function applySortParams(q: URLSearchParams, sort: PositionSort | null): void {
  if (sort) {
    q.set('sortBy', sort.key);
    q.set('sortDir', sort.dir);
  }
}
