export const MAX_NAME = 150;
export const MAX_DESCRIPTION = 1000;
export const MAX_SORT_ORDER = 32767;

/** Recorta el nombre y colapsa los espacios múltiples (lo que se guarda y se compara). */
export function cleanName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, ' ').trim();
}

/** Clave de comparación: sin mayúsculas, acentos ni espacios extra. Dos nombres con la misma clave son la misma competencia. */
export function nameKey(name: string | null | undefined): string {
  return cleanName(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Descripción guardada: sin espacios en los extremos; vacía = null. */
export function cleanDescription(description: string | null | undefined): string | null {
  const d = (description ?? '').trim();
  return d === '' ? null : d;
}
