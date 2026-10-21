import { type SortDir, sortRows } from '@/lib/sort-rows';

export type { SortDir };
export type SortKey = 'title' | 'macroprocess' | 'fileType' | 'chunkCount' | 'fileSize' | 'updatedAt';

interface SortableDocument {
  title: string;
  macroprocess: string | null;
  fileType: string | null;
  chunkCount: number;
  fileSize: number | null;
  updatedAt: string;
}

/** Valor comparable de la columna, o null si está vacío (los vacíos van siempre al final). */
function valueOf(doc: SortableDocument, key: SortKey): string | number | null {
  switch (key) {
    case 'title':
      return doc.title;
    case 'macroprocess':
      return doc.macroprocess;
    case 'fileType':
      return doc.fileType;
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

/** Ordena sin modificar el arreglo original (reglas en `sortRows`). */
export function sortDocuments<T extends SortableDocument>(docs: T[], key: SortKey, dir: SortDir): T[] {
  return sortRows(docs, (doc) => valueOf(doc, key), dir);
}
