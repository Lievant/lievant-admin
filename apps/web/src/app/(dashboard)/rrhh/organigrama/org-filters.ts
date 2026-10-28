/**
 * Lógica pura de los filtros del organigrama (sin React): selección, cascada
 * Empresa → División → Área a partir de las combinaciones reales del API,
 * limpieza de hijos inválidos y textos. Se prueba aparte.
 */

/** Valor especial: el campo vacío ("Sin División", "Sin Área", "Sin Nivel"…). */
export const NONE_VALUE = '__none__';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface OrgCombination {
  company: string | null;
  division: string | null;
  area: string | null;
  count: number;
}

export interface OrgFilterOptions {
  total: number;
  companies: FilterOption[];
  divisions: FilterOption[];
  areas: FilterOption[];
  levels: FilterOption[];
  locations: FilterOption[];
  combinations: OrgCombination[];
}

/** Selección actual ('' = sin filtro). */
export interface OrgSelection {
  company: string;
  division: string;
  area: string;
  level: string;
  location: string;
}

export const EMPTY_SELECTION: OrgSelection = { company: '', division: '', area: '', level: '', location: '' };

export const FILTER_KEYS = ['company', 'division', 'area', 'level', 'location'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Minúsculas y espacios sobrantes fuera (igual que en el API). */
export function normalizeValue(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const same = (a: string | null, selected: string): boolean =>
  selected === NONE_VALUE ? normalizeValue(a) === '' : normalizeValue(a) === normalizeValue(selected);

/** Combinaciones que cumplen lo ya elegido de empresa y división. */
function filterCombos(combos: OrgCombination[], sel: Pick<OrgSelection, 'company' | 'division'>): OrgCombination[] {
  return combos.filter((c) => (!sel.company || same(c.company, sel.company)) && (!sel.division || same(c.division, sel.division)));
}

/** Opciones de un campo (con conteos) a partir de las combinaciones; "Sin X" al final solo si existe. */
function optionsFrom(combos: OrgCombination[], field: 'division' | 'area', noneLabel: string): FilterOption[] {
  const groups = new Map<string, FilterOption>();
  let none = 0;
  for (const c of combos) {
    const v = c[field];
    if (v === null || normalizeValue(v) === '') {
      none += c.count;
      continue;
    }
    const key = normalizeValue(v);
    const cur = groups.get(key);
    if (cur) cur.count += c.count;
    else groups.set(key, { value: v, label: v, count: c.count });
  }
  const real = [...groups.values()].sort((a, b) => collator.compare(a.label, b.label));
  return none > 0 ? [...real, { value: NONE_VALUE, label: noneLabel, count: none }] : real;
}

/** Divisiones disponibles: las de la empresa elegida (o todas). */
export function divisionOptions(options: OrgFilterOptions, sel: Pick<OrgSelection, 'company'>): FilterOption[] {
  return optionsFrom(filterCombos(options.combinations, { company: sel.company, division: '' }), 'division', 'Sin División');
}

/** Áreas disponibles: las de la división (y la empresa) elegidas. */
export function areaOptions(options: OrgFilterOptions, sel: Pick<OrgSelection, 'company' | 'division'>): FilterOption[] {
  return optionsFrom(filterCombos(options.combinations, sel), 'area', 'Sin Área');
}

/**
 * Cuando cambia un filtro padre, el hijo que ya no es válido se limpia
 * (empresa → división → área). Nivel y ubicación no dependen de la cascada.
 */
export function sanitizeSelection(sel: OrgSelection, options: OrgFilterOptions): OrgSelection {
  const next = { ...sel };
  if (next.division && !divisionOptions(options, next).some((o) => normalizeValue(o.value) === normalizeValue(next.division))) next.division = '';
  if (next.area && !areaOptions(options, next).some((o) => normalizeValue(o.value) === normalizeValue(next.area))) next.area = '';
  return next;
}

/** Cambia un filtro y deja la selección coherente. */
export function applySelection(sel: OrgSelection, key: FilterKey, value: string, options: OrgFilterOptions): OrgSelection {
  return sanitizeSelection({ ...sel, [key]: value }, options);
}

export const activeFilterCount = (sel: OrgSelection): number => FILTER_KEYS.filter((k) => sel[k] !== '').length;

/** Query string del API ('' si no hay filtros). */
export function selectionToQuery(sel: OrgSelection): string {
  const q = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sel[k]) q.set(k, sel[k]);
  return q.toString();
}

/** Selección a partir de los parámetros de la URL. */
export function selectionFromParams(params: Record<string, string | string[] | undefined> | URLSearchParams): OrgSelection {
  const get = (k: FilterKey): string => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    const s = Array.isArray(v) ? v[0] : v;
    return (s ?? '').slice(0, 150);
  };
  return { company: get('company'), division: get('division'), area: get('area'), level: get('level'), location: get('location') };
}

/** "Nivel III" para el nodo y el modal; vacío si no hay nivel. */
export function levelLabel(level: string | null | undefined): string {
  const v = (level ?? '').trim();
  return v === '' ? '' : `Nivel ${v.toUpperCase()}`;
}

/** Nivel corto ("III") para la vista móvil compacta. */
export function levelShort(level: string | null | undefined): string {
  return (level ?? '').trim().toUpperCase();
}

export function countsLabel(matched: number, total: number): string {
  return `Mostrando ${matched} de ${total} Colaboradores`;
}

/** Aviso bajo la barra de filtros (solo con filtros activos): el árbol se corta y se reconecta. */
export const FILTER_CUT_NOTE = 'Los colaboradores cuyo jefe directo queda fuera del filtro se muestran bajo el siguiente jefe visible.';

/** Vista del organigrama: jerarquía (por defecto) o filas por nivel. */
export type OrgView = 'hierarchy' | 'levels';
export const VIEW_PARAM = 'vista';
export const LEVELS_VIEW_VALUE = 'niveles';

export function viewFromParams(params: Record<string, string | string[] | undefined> | URLSearchParams): OrgView {
  const v = params instanceof URLSearchParams ? params.get(VIEW_PARAM) : params[VIEW_PARAM];
  return (Array.isArray(v) ? v[0] : v) === LEVELS_VIEW_VALUE ? 'levels' : 'hierarchy';
}

/** Query de la URL de la pantalla: filtros + vista (la vista nunca se manda al API). */
export function pageQuery(sel: OrgSelection, view: OrgView): string {
  const q = new URLSearchParams(selectionToQuery(sel));
  if (view === 'levels') q.set(VIEW_PARAM, LEVELS_VIEW_VALUE);
  return q.toString();
}
