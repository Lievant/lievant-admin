/**
 * Nivel del empleado en los formularios: lista cerrada (`catalogs.org_levels`) más, al editar, el valor que el
 * empleado ya tenga si está fuera de catálogo (se muestra como «Fuera de Catálogo» para no perderlo).
 */
export interface LevelCatalogItem {
  code?: string | null | undefined;
  name: string;
}

const key = (v: string | null | undefined): string => (v ?? '').trim().replace(/\s+/g, '').toUpperCase();

/** Valor del select y, si el nivel actual no está en el catálogo, ese valor aparte. */
export function levelSelection(catalog: LevelCatalogItem[], current: string | null | undefined): { value: string; legacy: string | null } {
  const text = (current ?? '').trim();
  if (text === '') return { value: '', legacy: null };
  const hit = catalog.find((l) => l.code && key(l.code) === key(text));
  return hit ? { value: hit.code as string, legacy: null } : { value: text, legacy: text };
}

export function levelOptions(catalog: LevelCatalogItem[], legacy: string | null): { value: string; label: string }[] {
  const options = catalog.filter((l) => l.code).map((l) => ({ value: l.code as string, label: `${l.code} - ${l.name}` }));
  return legacy ? [{ value: legacy, label: `${legacy} (Fuera de Catálogo)` }, ...options] : options;
}
