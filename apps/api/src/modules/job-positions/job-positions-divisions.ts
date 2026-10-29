/**
 * Divisiones de la Matriz de Puestos: lista cerrada que sale de `catalogs.divisions` (activas). El mismo nombre
 * puede existir para varias empresas (el índice único es nombre + empresa); aquí se muestra una sola vez.
 */
import { BadRequestException } from '@nestjs/common';
import { normText } from './job-positions-catalog.util';

type Q = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

/** Quita repetidos (sin distinguir mayúsculas, acentos ni espacios) y ordena por nombre. */
export function uniqueDivisionNames(names: readonly (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    const name = (n ?? '').trim();
    if (name !== '' && !seen.has(normText(name))) seen.set(normText(name), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

/** Divisiones activas del catálogo, ordenadas por nombre, sin repetir. */
export async function loadCatalogDivisions(m: Q): Promise<string[]> {
  const rows = (await m.query(`SELECT name FROM catalogs.divisions WHERE is_active IS NOT FALSE ORDER BY name`)) as { name: string }[];
  return uniqueDivisionNames(rows.map((r) => r.name));
}

/** Nombre canónico del catálogo para un valor escrito de otra forma («E-COMMERCE» → «E-Commerce»); null si no existe. */
export function canonicalDivision(catalog: readonly string[], value: string | null | undefined): string | null {
  const key = normText(value);
  if (key === '') return null;
  return catalog.find((d) => normText(d) === key) ?? null;
}

/** 400 con la lista de las válidas. */
export function divisionNotInCatalog(value: string, catalog: readonly string[]): BadRequestException {
  return new BadRequestException(
    `La división «${value}» no está en el catálogo de divisiones. Elige una de la lista: ${catalog.length > 0 ? catalog.join(', ') : '(el catálogo está vacío)'}`,
  );
}
