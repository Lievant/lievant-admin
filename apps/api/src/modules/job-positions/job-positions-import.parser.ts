/**
 * Lectura de la hoja "Matriz …" del Excel de la división (sin base de datos ni ExcelJS: recibe filas de texto).
 * Mapea columnas por nombre normalizado, separa actividades, OKRs y KPIs de sus celdas de texto y devuelve
 * avisos (no bloquean) y errores (bloquean la importación).
 */
import {
  ACTIVITY_FREQUENCIES,
  MEASUREMENT_FREQUENCIES,
  VALIDATION_STATUSES,
  type ActivityFrequency,
  type ValidationStatus,
} from './job-positions.util';

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_KPI_TARGET = 100;
export const NO_KEY_RESULT = 'Por definir';

// Límites de las columnas de la base (los textos más largos bloquean la importación).
const LIMITS = { title: 200, area: 100, level: 50, meot: 100, reportsTo: 500, supervises: 500, groupTitle: 300, kpiName: 200, code: 10 } as const;

export interface ImportIssue {
  /** Fila del Excel (null = del archivo en general). */
  row: number | null;
  message: string;
}

export interface ParsedActivity {
  groupOrder: number;
  groupTitle: string;
  sortOrder: number;
  description: string;
  frequency: ActivityFrequency | null;
  note: string | null;
}

export interface ParsedOkr {
  objectiveCode: string;
  krCode: string;
  objective: string;
  keyResult: string;
  sortOrder: number;
}

export interface ParsedKpi {
  name: string;
  targetValue: string | null;
  frequency: string | null;
  description: string | null;
}

export interface ParsedPosition {
  row: number;
  title: string;
  area: string;
  level: string | null;
  meotHierarchy: string | null;
  reportsTo: string | null;
  supervises: string | null;
  plazas: number | null;
  roleSummary: string | null;
  positionObjective: string | null;
  validationPoints: string | null;
  validationStatus: ValidationStatus;
  headComments: string | null;
  activities: ParsedActivity[];
  okrs: ParsedOkr[];
  kpis: ParsedKpi[];
}

/** Columnas del archivo que se encontraron (las que faltan no se tocan al actualizar). */
export type ColumnKey =
  | 'area' | 'title' | 'level' | 'meot' | 'reportsTo' | 'supervises' | 'plazas' | 'role' | 'objective'
  | 'activities' | 'okrs' | 'kpis' | 'validationPoints' | 'status' | 'comments';

export interface ParseResult {
  sheetName: string | null;
  divisionHint: string | null;
  columns: ReadonlySet<ColumnKey>;
  positions: ParsedPosition[];
  warnings: ImportIssue[];
  errors: ImportIssue[];
  /** Filas de datos con contenido (para el límite de 500). */
  dataRows: number;
}

export interface RawSheet {
  name: string;
  /** Fila 1 = índice 0; columna A = índice 0. */
  rows: string[][];
}

/** Sin acentos, en minúsculas y con espacios simples. */
export function norm(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADERS: { key: ColumnKey; test: (h: string) => boolean; label: string }[] = [
  { key: 'area', test: (h) => /^sub[- ]?area\b/.test(h) || h === 'area', label: 'Sub-área' },
  { key: 'title', test: (h) => h === 'puesto', label: 'Puesto' },
  { key: 'level', test: (h) => h.startsWith('nivel'), label: 'Nivel tabular' },
  { key: 'meot', test: (h) => h.startsWith('jerarquia'), label: 'Jerarquía (MEOT)' },
  { key: 'reportsTo', test: (h) => h.startsWith('reporta a'), label: 'Reporta a' },
  { key: 'supervises', test: (h) => h.startsWith('supervisa'), label: 'Supervisa a' },
  { key: 'plazas', test: (h) => h.startsWith('plazas'), label: 'Plazas ocupadas' },
  { key: 'role', test: (h) => h === 'rol', label: 'Rol' },
  { key: 'objective', test: (h) => h.startsWith('objetivo del puesto'), label: 'Objetivo del puesto' },
  { key: 'activities', test: (h) => h.startsWith('responsabilidades') || h.startsWith('actividades'), label: 'Responsabilidades y actividades' },
  { key: 'okrs', test: (h) => /^okrs?\b/.test(h), label: 'OKRs' },
  { key: 'kpis', test: (h) => /^kpis?\b/.test(h), label: 'KPIs' },
  { key: 'validationPoints', test: (h) => h.startsWith('puntos a validar'), label: 'Puntos a validar' },
  { key: 'status', test: (h) => h.startsWith('estatus'), label: 'Estatus validación' },
  { key: 'comments', test: (h) => h.startsWith('comentarios'), label: 'Comentarios del Head' },
];

/** Mapa columna → índice, o null si la fila no es de encabezados (necesita Puesto y Sub-área). */
function mapHeaders(row: string[]): Map<ColumnKey, number> | null {
  const map = new Map<ColumnKey, number>();
  row.forEach((cell, i) => {
    const h = norm(cell);
    if (!h) return;
    const hit = HEADERS.find((x) => !map.has(x.key) && x.test(h));
    if (hit) map.set(hit.key, i);
  });
  return map.has('title') && map.has('area') ? map : null;
}

/** "División E-Commerce · Propuesta…" → "E-Commerce". */
export function deduceDivision(title: string | null | undefined): string | null {
  const m = /divisi[oó]n\s+(.+?)\s*(?:[·•|–—]|$)/i.exec(title ?? '');
  return m && m[1] ? m[1].trim() : null;
}

/** Quita "(VACANTE)" (cualquier mayúscula) del título. */
export function cleanTitle(raw: string): { title: string; vacant: boolean } {
  const vacant = /\(\s*vacante\s*\)/i.test(raw);
  return { title: raw.replace(/\(\s*vacante\s*\)/gi, ' ').replace(/\s+/g, ' ').trim(), vacant };
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim() !== '');
}

/** Última pareja de paréntesis cuyo contenido es una frecuencia permitida. */
function splitFrequency(text: string): { before: string; frequency: ActivityFrequency; after: string } | null {
  const re = /\(([^()]*)\)/g;
  let found: { index: number; length: number; frequency: ActivityFrequency } | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const f = norm(m[1]);
    if ((ACTIVITY_FREQUENCIES as readonly string[]).includes(f)) found = { index: m.index, length: m[0].length, frequency: f as ActivityFrequency };
  }
  if (!found) return null;
  return { before: text.slice(0, found.index).trim(), frequency: found.frequency, after: text.slice(found.index + found.length) };
}

const stripLead = (s: string): string => s.replace(/^[\s\-–—:·]+/, '').trim();

export function parseActivities(text: string, row: number, warnings: ImportIssue[], errors: ImportIssue[]): ParsedActivity[] {
  const out: ParsedActivity[] = [];
  let group: { order: number; title: string } | null = null;
  let sort = 0;
  for (const line of lines(text)) {
    const g = /^(\d+)\.\s+(.*\S)\s*$/.exec(line);
    const a = /^\s*(\d+)\.(\d+)\s+(.*\S)\s*$/.exec(line);
    if (g && !/^\s/.test(line)) {
      group = { order: Number(g[1]), title: g[2]!.trim() };
      sort = 0;
      if (group.title.length > LIMITS.groupTitle) errors.push({ row, message: `El título del grupo de actividades «${group.title.slice(0, 40)}…» pasa de ${LIMITS.groupTitle} caracteres` });
      continue;
    }
    if (a) {
      if (!group) {
        group = { order: Number(a[1]), title: 'Sin grupo' };
        sort = 0;
        warnings.push({ row, message: `La actividad ${a[1]}.${a[2]} no tiene un grupo; se guardó en «Sin grupo»` });
      }
      const body = a[3]!.trim();
      const split = splitFrequency(body);
      sort += 1;
      if (split) {
        out.push({
          groupOrder: group.order,
          groupTitle: group.title,
          sortOrder: sort,
          description: split.before,
          frequency: split.frequency,
          // Lo que haya después del paréntesis es la nota; si solo queda un signo suelto (p. ej. «-») se conserva tal cual.
          note: stripLead(split.after) || split.after.trim() || null,
        });
      } else {
        warnings.push({ row, message: `La actividad ${a[1]}.${a[2]} no trae una frecuencia reconocida; se guardó sin frecuencia` });
        out.push({ groupOrder: group.order, groupTitle: group.title, sortOrder: sort, description: body, frequency: null, note: null });
      }
      continue;
    }
    warnings.push({ row, message: `Línea de actividades no reconocida (se ignoró): «${line.trim().slice(0, 60)}»` });
  }
  return out;
}

export function parseOkrs(text: string, row: number, warnings: ImportIssue[], errors: ImportIssue[]): ParsedOkr[] {
  const out: ParsedOkr[] = [];
  let objective: { code: string; text: string; krs: number } | null = null;
  const closeObjective = () => {
    if (objective && objective.krs === 0) {
      out.push({ objectiveCode: objective.code, krCode: 'KR1', objective: objective.text, keyResult: NO_KEY_RESULT, sortOrder: out.length + 1 });
      warnings.push({ row, message: `El objetivo ${objective.code} no trae resultados clave; se guardó con «${NO_KEY_RESULT}»` });
    }
  };
  for (const line of lines(text)) {
    const o = /^\s*O(\d+)\s*:\s*(.*\S)\s*$/i.exec(line);
    const k = /^\s*KR(\d+)\s*:\s*(.*\S)\s*$/i.exec(line);
    if (o) {
      closeObjective();
      objective = { code: `O${o[1]}`, text: o[2]!.trim(), krs: 0 };
      if (objective.code.length > LIMITS.code) errors.push({ row, message: `El código ${objective.code} pasa de ${LIMITS.code} caracteres` });
      continue;
    }
    if (k) {
      if (!objective) {
        warnings.push({ row, message: `El resultado clave KR${k[1]} no tiene un objetivo (se ignoró)` });
        continue;
      }
      objective.krs += 1;
      out.push({ objectiveCode: objective.code, krCode: `KR${k[1]}`, objective: objective.text, keyResult: k[2]!.trim(), sortOrder: out.length + 1 });
      continue;
    }
    warnings.push({ row, message: `Línea de OKRs no reconocida (se ignoró): «${line.trim().slice(0, 60)}»` });
  }
  closeObjective();
  return out;
}

export function parseKpis(text: string, row: number, warnings: ImportIssue[], errors: ImportIssue[]): ParsedKpi[] {
  const out: ParsedKpi[] = [];
  for (const raw of lines(text)) {
    const line = raw.trim();
    if (!line.startsWith('•')) {
      warnings.push({ row, message: `Línea de KPIs sin viñeta (se ignoró): «${line.slice(0, 60)}»` });
      continue;
    }
    const parts = line.slice(1).split('|').map((p) => p.trim());
    const name = parts[0] ?? '';
    if (parts.length < 3 || name === '') {
      warnings.push({ row, message: `KPI con formato incorrecto (se ignoró): «${line.slice(0, 60)}»` });
      continue;
    }
    if (name.length > LIMITS.kpiName) errors.push({ row, message: `El nombre del KPI «${name.slice(0, 40)}…» pasa de ${LIMITS.kpiName} caracteres` });

    const extra: string[] = [];
    let target: string | null = parts[1]!.replace(/^meta\s*:\s*/i, '').trim() || null;
    if (target && target.length > MAX_KPI_TARGET) {
      extra.push(`Meta: ${target}`);
      warnings.push({ row, message: `La meta del KPI «${name.slice(0, 40)}» pasa de ${MAX_KPI_TARGET} caracteres; se recortó y el texto completo quedó en la descripción` });
      target = target.slice(0, MAX_KPI_TARGET);
    }

    // Frecuencia: la primera palabra reconocible de la tercera parte; el resto del texto va a la descripción.
    const rest = parts.slice(2).join(' | ');
    const words = rest.split(/\s+/).filter(Boolean);
    const at = words.findIndex((w) => (MEASUREMENT_FREQUENCIES as readonly string[]).includes(norm(w).replace(/[^a-z]/g, '')));
    let frequency: string | null = null;
    if (at >= 0) {
      frequency = norm(words[at]).replace(/[^a-z]/g, '');
      const remainder = stripLead([...words.slice(0, at), ...words.slice(at + 1)].join(' '));
      if (remainder) extra.push(remainder);
    } else {
      warnings.push({ row, message: `El KPI «${name.slice(0, 40)}» no trae una frecuencia reconocida; se guardó sin frecuencia` });
      if (rest.trim()) extra.push(rest.trim());
    }
    out.push({ name, targetValue: target, frequency, description: extra.length > 0 ? extra.join('\n') : null });
  }
  return out;
}

function parseStatus(text: string, row: number, warnings: ImportIssue[]): ValidationStatus {
  const n = norm(text);
  if (n === '') return 'pendiente';
  const hit = VALIDATION_STATUSES.find((s) => s.replace(/_/g, ' ') === n);
  if (hit) return hit;
  warnings.push({ row, message: `El estatus de validación «${text.trim().slice(0, 30)}» no es válido; se tomó como Pendiente` });
  return 'pendiente';
}

/** Hoja de la matriz: la que empieza con "Matriz" o, si no hay, la primera que tenga los encabezados. */
export function pickSheet(sheets: RawSheet[]): { sheet: RawSheet; headerRow: number; map: Map<ColumnKey, number> } | null {
  const findHeader = (s: RawSheet): { headerRow: number; map: Map<ColumnKey, number> } | null => {
    for (let i = 0; i < Math.min(s.rows.length, 20); i++) {
      const map = mapHeaders(s.rows[i] ?? []);
      if (map) return { headerRow: i, map };
    }
    return null;
  };
  const ordered = [...sheets.filter((s) => norm(s.name).startsWith('matriz')), ...sheets.filter((s) => !norm(s.name).startsWith('matriz'))];
  for (const s of ordered) {
    const h = findHeader(s);
    if (h) return { sheet: s, ...h };
  }
  return null;
}

export function parseMatrixSheets(sheets: RawSheet[]): ParseResult {
  const warnings: ImportIssue[] = [];
  const errors: ImportIssue[] = [];
  const picked = pickSheet(sheets);
  if (!picked) {
    return {
      sheetName: null,
      divisionHint: null,
      columns: new Set(),
      positions: [],
      warnings,
      errors: [{ row: null, message: 'No se encontró la hoja de la matriz: se necesita una fila de encabezados con «Puesto» y «Sub-área»' }],
      dataRows: 0,
    };
  }
  const { sheet, headerRow, map } = picked;
  const columns = new Set(map.keys()) as Set<ColumnKey>;
  for (const h of HEADERS) {
    if (!columns.has(h.key)) warnings.push({ row: null, message: `No se encontró la columna «${h.label}»; ese campo no se llenará ni se modificará` });
  }
  const divisionHint = deduceDivision(sheet.rows[0]?.find((c) => c && c.trim() !== '') ?? null) ?? deduceDivision(sheet.rows[1]?.[0] ?? null);

  const cell = (r: string[], key: ColumnKey): string => {
    const i = map.get(key);
    return i === undefined ? '' : (r[i] ?? '').toString().trim();
  };
  const text = (r: string[], key: ColumnKey): string | null => cell(r, key) || null;

  const positions: ParsedPosition[] = [];
  const seen = new Map<string, number>();
  let dataRows = 0;
  for (let i = headerRow + 1; i < sheet.rows.length; i++) {
    const r = sheet.rows[i] ?? [];
    const rowNumber = i + 1;
    const titleRaw = cell(r, 'title');
    const area = cell(r, 'area');
    // Una fila sin Puesto, sin Sub-área y sin nada más es una fila vacía; el "#" suelto no cuenta.
    const hasContent = [...map.entries()].some(([k, idx]) => k !== 'title' && k !== 'area' && (r[idx] ?? '').toString().trim() !== '');
    if (titleRaw === '' && area === '' && !hasContent) continue;
    dataRows += 1;
    if (titleRaw === '') {
      errors.push({ row: rowNumber, message: 'Falta el Puesto' });
      continue;
    }
    if (area === '') {
      errors.push({ row: rowNumber, message: `Falta la Sub-área del puesto «${titleRaw.slice(0, 40)}»` });
      continue;
    }
    const { title, vacant } = cleanTitle(titleRaw);
    if (title === '') {
      errors.push({ row: rowNumber, message: 'Falta el Puesto' });
      continue;
    }
    const checkLen = (value: string | null, limit: number, label: string) => {
      if (value && value.length > limit) errors.push({ row: rowNumber, message: `${label} pasa de ${limit} caracteres` });
    };
    checkLen(title, LIMITS.title, 'El Puesto');
    checkLen(area, LIMITS.area, 'La Sub-área');
    const level = text(r, 'level');
    const meot = text(r, 'meot');
    const reportsTo = text(r, 'reportsTo');
    const supervises = text(r, 'supervises');
    checkLen(level, LIMITS.level, 'El Nivel');
    checkLen(meot, LIMITS.meot, 'La Jerarquía (MEOT)');
    checkLen(reportsTo, LIMITS.reportsTo, '«Reporta a»');
    checkLen(supervises, LIMITS.supervises, '«Supervisa a»');

    let plazas: number | null = null;
    const plazasText = cell(r, 'plazas');
    if (plazasText !== '') {
      const n = Number(plazasText.replace(',', '.'));
      if (Number.isFinite(n) && n >= 0 && Number.isInteger(n)) plazas = n;
      else warnings.push({ row: rowNumber, message: `Las plazas «${plazasText.slice(0, 20)}» no son un entero; se dejaron vacías` });
    }
    if (vacant && plazas === null) plazas = 0;

    const key = `${norm(area)}|${norm(title)}`;
    const first = seen.get(key);
    if (first !== undefined) errors.push({ row: rowNumber, message: `El puesto «${title.slice(0, 40)}» ya aparece en la fila ${first} (misma Sub-área)` });
    else seen.set(key, rowNumber);

    positions.push({
      row: rowNumber,
      title,
      area,
      level,
      meotHierarchy: meot,
      reportsTo,
      supervises,
      plazas,
      roleSummary: text(r, 'role'),
      positionObjective: text(r, 'objective'),
      validationPoints: text(r, 'validationPoints'),
      validationStatus: parseStatus(cell(r, 'status'), rowNumber, warnings),
      headComments: text(r, 'comments'),
      activities: parseActivities(cell(r, 'activities'), rowNumber, warnings, errors),
      okrs: parseOkrs(cell(r, 'okrs'), rowNumber, warnings, errors),
      kpis: parseKpis(cell(r, 'kpis'), rowNumber, warnings, errors),
    });
  }
  if (positions.length === 0 && errors.length === 0) errors.push({ row: null, message: 'La hoja no trae ningún puesto' });
  return { sheetName: sheet.name, divisionHint, columns, positions, warnings, errors, dataRows };
}
