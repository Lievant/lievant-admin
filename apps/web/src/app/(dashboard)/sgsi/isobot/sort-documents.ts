export type SortKey = 'title' | 'macroprocess' | 'fileType' | 'chunkCount' | 'fileSize' | 'updatedAt';
export type SortDir = 'asc' | 'desc';

interface SortableDocument {
  title: string;
  macroprocess: string | null;
  fileType: string | null;
  chunkCount: number;
  fileSize: number | null;
  updatedAt: string;
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Valor comparable de la columna, o null si está vacío (los vacíos van siempre al final). */
function valueOf(doc: SortableDocument, key: SortKey): string | number | null {
  switch (key) {
    case 'title':
      return doc.title.trim() || null;
    case 'macroprocess':
      return doc.macroprocess?.trim() || null;
    case 'fileType':
      return doc.fileType?.trim() || null;
    case 'chunkCount':
      return Number.isFinite(doc.chunkCount) ? doc.chunkCount : null;
    case 'fileSize':
      return doc.fileSize !== null && Number.isFinite(doc.fileSize) ? doc.fileSize : null;
    case 'updatedAt': {
      const time = Date.parse(doc.updatedAt);
      return Number.isNaN(time) ? null : time;
    }
  }
}

/**
 * Ordena sin modificar el arreglo original. Texto sin distinguir mayúsculas ni
 * acentos y con orden natural en español; números y fechas por su valor real.
 * Los vacíos quedan al final en ambos sentidos y el orden es estable.
 */
export function sortDocuments<T extends SortableDocument>(docs: T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return docs
    .map((doc, index) => ({ doc, index, value: valueOf(doc, key) }))
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
    .map(({ doc }) => doc);
}
