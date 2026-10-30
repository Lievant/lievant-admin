/**
 * Lectura de la hoja de competencias del Excel (sin base de datos ni ExcelJS: recibe filas de texto).
 * Columnas por nombre (sin importar mayúsculas, acentos ni espacios): «Competencia» (o «Nombre») es obligatoria;
 * «ID», «Descripción» y «Orden» son opcionales. Devuelve errores (bloquean toda la importación) y las filas válidas.
 */
import { MAX_DESCRIPTION, MAX_NAME, MAX_SORT_ORDER, cleanDescription, cleanName, nameKey } from './competencies.util';

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const HEADER_SCAN_ROWS = 10;

export interface RawSheet {
  name: string;
  rows: string[][];
}

export interface ImportIssue {
  /** Fila del Excel (null = del archivo en general). */
  row: number | null;
  message: string;
}

export interface ParsedCompetency {
  /** Fila del Excel. */
  row: number;
  name: string;
  key: string;
  /** null = el archivo no trae descripción para esta fila (no se pisa la que ya tiene). */
  description: string | null;
  /** null = el archivo no trae orden para esta fila (no se pisa el que ya tiene; en una alta queda la posición). */
  order: number | null;
  /** Posición (1, 2, 3…) entre las filas con datos: el orden de una alta sin orden. */
  position: number;
}

export interface ParseResult {
  sheetName: string | null;
  /** Filas con datos (sin contar las totalmente vacías). */
  dataRows: number;
  rows: ParsedCompetency[];
  errors: ImportIssue[];
}

const squash = (t: string): string =>
  (t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const HEADER_NAMES = {
  name: ['competencia', 'nombre'],
  id: ['id'],
  description: ['descripcion'],
  order: ['orden'],
} as const;

type ColumnKey = keyof typeof HEADER_NAMES;

function findHeader(rows: string[][]): { index: number; columns: Partial<Record<ColumnKey, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, HEADER_SCAN_ROWS); i++) {
    const cells = rows[i] ?? [];
    const columns: Partial<Record<ColumnKey, number>> = {};
    cells.forEach((cell, col) => {
      const s = squash(cell ?? '');
      if (s === '') return;
      for (const key of Object.keys(HEADER_NAMES) as ColumnKey[]) {
        if (columns[key] === undefined && (HEADER_NAMES[key] as readonly string[]).includes(s)) columns[key] = col;
      }
    });
    if (columns.name !== undefined) return { index: i, columns };
  }
  return null;
}

/** Entero de 0 a 32767 escrito solo con dígitos; si no, null. */
function toOrder(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= MAX_SORT_ORDER ? n : null;
}

export function parseCompetenciesSheets(sheets: RawSheet[]): ParseResult {
  const sheet = sheets.find((s) => squash(s.name).startsWith('competencias')) ?? sheets[0];
  if (!sheet) return { sheetName: null, dataRows: 0, rows: [], errors: [{ row: null, message: 'El archivo no tiene hojas.' }] };
  const header = findHeader(sheet.rows);
  if (!header) {
    return {
      sheetName: sheet.name,
      dataRows: 0,
      rows: [],
      errors: [{ row: null, message: 'No se encontró la columna «Competencia» en las primeras 10 filas de la hoja.' }],
    };
  }
  const { columns } = header;
  const errors: ImportIssue[] = [];
  const rows: ParsedCompetency[] = [];
  const firstRowOfKey = new Map<string, number>();
  let dataRows = 0;

  for (let i = header.index + 1; i < sheet.rows.length; i++) {
    const cells = sheet.rows[i] ?? [];
    if (cells.every((c) => (c ?? '').trim() === '')) continue;
    dataRows++;
    const row = i + 1;
    const cell = (col: number | undefined): string => (col === undefined ? '' : (cells[col] ?? '').trim());
    let valid = true;
    const fail = (message: string): void => {
      errors.push({ row, message });
      valid = false;
    };

    const name = cleanName(cell(columns.name));
    if (name === '') fail('La competencia no tiene nombre.');
    else if (name.length > MAX_NAME) fail(`El nombre pasa de ${MAX_NAME} caracteres.`);
    const key = nameKey(name);
    if (name !== '') {
      const first = firstRowOfKey.get(key);
      if (first !== undefined) fail(`El nombre está repetido en el archivo (también en la fila ${first}).`);
      else firstRowOfKey.set(key, row);
    }

    const description = cleanDescription(cell(columns.description));
    if (description !== null && description.length > MAX_DESCRIPTION) fail(`La descripción pasa de ${MAX_DESCRIPTION} caracteres.`);

    // Orden: la columna «Orden» manda; sin esa columna, el «ID» numérico del Excel sirve de orden (no se guarda como id);
    // sin ninguna de las dos, el orden es la posición de la fila.
    let order: number | null = null;
    if (columns.order !== undefined) {
      const text = cell(columns.order);
      if (text !== '') {
        order = toOrder(text);
        if (order === null) fail(`El Orden «${text}» no es válido: debe ser un entero de 0 a ${MAX_SORT_ORDER}.`);
      }
    } else if (columns.id !== undefined) {
      const text = cell(columns.id);
      if (/^\d+$/.test(text)) {
        order = toOrder(text);
        if (order === null) fail(`El ID «${text}» no sirve como Orden: debe ser un entero de 0 a ${MAX_SORT_ORDER}.`);
      }
    } else {
      order = dataRows;
    }

    if (valid) rows.push({ row, name, key, description, order, position: dataRows });
  }

  if (dataRows === 0) errors.push({ row: null, message: 'La hoja no tiene competencias.' });
  return { sheetName: sheet.name, dataRows, rows, errors };
}
