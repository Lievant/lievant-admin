/**
 * Organigrama: construcción del árbol en memoria a partir de los empleados
 * activos y `direct_report_to_id`. Funciones puras, sin acceso a datos.
 */

/**
 * Muestra el celular del expediente a cualquier usuario autenticado, como pide el
 * RFP (pendiente de confirmar con Paulo). Para apagarlo basta cambiar esta línea:
 * el API deja de leer y de devolver el teléfono.
 */
export const ORG_CHART_SHOW_PHONE = true;

/** Fila mínima que lee el organigrama (nunca la entidad completa). */
export interface OrgRow {
  id: string;
  displayId: string;
  fullName: string;
  position: string;
  area: string | null;
  level: string | null;
  companyName: string | null;
  division: string | null;
  location: string | null;
  corporateEmail: string | null;
  phone: string | null;
  directReportToId: string | null;
}

/**
 * Nodo de la respuesta. Lista blanca explícita: nada de remuneración, datos
 * personales sensibles, documentos ni notas internas. `children` son los
 * subordinados directos (el árbol ya viene anidado).
 */
export interface OrgNode {
  id: string;
  displayId: string;
  fullName: string;
  position: string;
  area: string | null;
  level: string | null;
  companyName: string | null;
  division: string | null;
  photoUrl: string | null;
  corporateEmail: string | null;
  phone?: string | null;
  /** Verdadero si el nodo solo está por ser jefe (directo o no) de alguien que coincide con los filtros. */
  inContext: boolean;
  children: OrgNode[];
}

/** Nodo neutro "Organización": agrupa varias raíces; no es una persona. */
export interface OrgRootNode {
  id: 'organization';
  synthetic: true;
  fullName: 'Organización';
  children: OrgNode[];
}

export interface OrgTreeResult {
  root: OrgNode | OrgRootNode | null;
  stats: { employees: number; roots: number; orphans: number; cycles: number };
}

/** Conteos para "Mostrando X de Y": X = coincidencias (sin los nodos de contexto), Y = activos en total. */
export interface OrgCounts {
  matched: number;
  total: number;
}

export const ORGANIZATION_ID = 'organization';

/**
 * URL de la foto. Se reutiliza el mecanismo de avatares del sistema
 * (/api/users/:correo/photo, que cachea la respuesta de Microsoft Graph); no se
 * llama a Graph desde aquí ni se guardan fotos nuevas.
 */
export function photoUrlFor(email: string | null): string | null {
  return email ? `/api/users/${encodeURIComponent(email)}/photo` : null;
}

function toNode(row: OrgRow, showPhone: boolean, contextIds: ReadonlySet<string>): OrgNode {
  const node: OrgNode = {
    id: row.id,
    displayId: row.displayId,
    fullName: row.fullName,
    position: row.position,
    area: row.area,
    level: row.level,
    companyName: row.companyName,
    division: row.division,
    photoUrl: photoUrlFor(row.corporateEmail),
    corporateEmail: row.corporateEmail,
    inContext: contextIds.has(row.id),
    children: [],
  };
  if (showPhone) node.phone = row.phone;
  return node;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/**
 * Arma el árbol.
 *
 * - Raíces: sin jefe, o con un jefe que no está entre las filas (inactivo, dado
 *   de baja, inexistente o filtrado): los huérfanos no desaparecen.
 * - Ciclos (A reporta a B y B a A): se rompen cortando el vínculo de uno de sus
 *   integrantes, que pasa a ser raíz; `onCycle` recibe el aviso. Nunca recursión
 *   infinita: el recorrido es iterativo y cada nodo se visita una sola vez.
 * - Una sola raíz → el árbol parte de ella; varias → cuelgan de "Organización".
 */
export function buildOrgTree(
  rows: OrgRow[],
  options: { showPhone?: boolean; onCycle?: (message: string) => void; contextIds?: ReadonlySet<string> } = {},
): OrgTreeResult {
  const showPhone = options.showPhone ?? ORG_CHART_SHOW_PHONE;
  const contextIds = options.contextIds ?? new Set<string>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sorted = [...rows].sort((a, b) => collator.compare(a.fullName, b.fullName) || a.id.localeCompare(b.id));

  // Jefe efectivo de cada fila (null = raíz); los ciclos se cortan más abajo.
  const parentOf = new Map<string, string | null>();
  const roots: OrgRow[] = [];
  let orphans = 0;
  for (const row of sorted) {
    const p = row.directReportToId;
    if (p && p !== row.id && byId.has(p)) {
      parentOf.set(row.id, p);
    } else {
      parentOf.set(row.id, null);
      roots.push(row);
      // Con jefe declarado pero ausente (o apuntándose a sí mismo) es huérfano.
      if (p) orphans++;
    }
  }

  const childrenOf = new Map<string, OrgRow[]>();
  const attach = () => {
    childrenOf.clear();
    for (const row of sorted) {
      const p = parentOf.get(row.id);
      if (p) {
        const list = childrenOf.get(p) ?? [];
        list.push(row);
        childrenOf.set(p, list);
      }
    }
  };
  attach();

  // Detección de ciclos: los nodos que no se alcanzan desde ninguna raíz solo
  // pueden estar en un ciclo (o colgar de uno).
  const reachable = (starts: OrgRow[]): Set<string> => {
    const seen = new Set<string>();
    const stack = [...starts];
    while (stack.length > 0) {
      const row = stack.pop()!;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      for (const child of childrenOf.get(row.id) ?? []) stack.push(child);
    }
    return seen;
  };

  let seen = reachable(roots);
  let cycles = 0;
  for (const row of sorted) {
    if (seen.has(row.id)) continue;
    // Sube por los jefes hasta repetir un nodo: ahí está el ciclo.
    const path: string[] = [];
    const index = new Map<string, number>();
    let cursor: string | null = row.id;
    while (cursor && !index.has(cursor)) {
      index.set(cursor, path.length);
      path.push(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
    const cycle = cursor ? path.slice(index.get(cursor)!) : [];
    if (cycle.length > 0) {
      // Se corta en el integrante de nombre menor (criterio estable) y queda como raíz.
      const cut = cycle
        .map((id) => byId.get(id)!)
        .sort((a, b) => collator.compare(a.fullName, b.fullName) || a.id.localeCompare(b.id))[0]!;
      parentOf.set(cut.id, null);
      roots.push(cut);
      cycles++;
      options.onCycle?.(
        `Ciclo en el organigrama: ${cycle.map((id) => byId.get(id)!.fullName).join(' → ')}. Se rompe en ${cut.fullName}.`,
      );
      attach();
      seen = reachable(roots);
    }
  }

  const build = (row: OrgRow): OrgNode => {
    // Iterativo para no depender de la profundidad de la pila.
    const rootNode = toNode(row, showPhone, contextIds);
    const stack: { row: OrgRow; node: OrgNode }[] = [{ row, node: rootNode }];
    while (stack.length > 0) {
      const { row: r, node } = stack.pop()!;
      for (const child of childrenOf.get(r.id) ?? []) {
        const childNode = toNode(child, showPhone, contextIds);
        node.children.push(childNode);
        stack.push({ row: child, node: childNode });
      }
    }
    return rootNode;
  };

  const rootRows = roots.sort((a, b) => collator.compare(a.fullName, b.fullName) || a.id.localeCompare(b.id));
  const stats = { employees: rows.length, roots: rootRows.length, orphans, cycles };
  if (rootRows.length === 0) return { root: null, stats };
  if (rootRows.length === 1) return { root: build(rootRows[0]!), stats };
  return {
    root: { id: ORGANIZATION_ID, synthetic: true, fullName: 'Organización', children: rootRows.map(build) },
    stats,
  };
}

/** Valores de ubicación presentes en las filas, para el filtro (sin vacíos, sin repetir). */
export function distinctLocations(locations: (string | null)[]): string[] {
  return [...new Set(locations.filter((l): l is string => !!l && l.trim() !== ''))].sort((a, b) => collator.compare(a, b));
}

// ── Filtros (Empresa, División, Área, Nivel y Ubicación) ─────────────────────

/** Valor especial de un filtro: "Sin División", "Sin Área", "Sin Nivel"… (campo vacío). */
export const NONE_VALUE = '__none__';

export interface OrgFilters {
  company?: string | undefined;
  division?: string | undefined;
  area?: string | undefined;
  level?: string | undefined;
  /** El filtro "País" que ya existía: opera sobre `location` (el expediente no tiene campo de país). */
  location?: string | undefined;
}

/** Minúsculas y espacios sobrantes fuera, para comparar sin distinguir mayúsculas ni espacios. */
export function normalizeValue(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const ROMAN_CANONICAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/**
 * Valor numérico de un número romano ('III' → 3), tolerante a mayúsculas y
 * espacios. Devuelve null si está vacío o no es un romano válido (p. ej. 'IIII',
 * 'A1', 'Senior').
 */
export function romanToNumber(value: string | null | undefined): number | null {
  const v = (value ?? '').replace(/\s+/g, '').toUpperCase();
  if (v === '' || !ROMAN_CANONICAL.test(v)) return null;
  let total = 0;
  for (let i = 0; i < v.length; i++) {
    const cur = ROMAN_VALUES[v[i] as string] as number;
    const next = i + 1 < v.length ? (ROMAN_VALUES[v[i + 1] as string] as number) : 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/**
 * Orden de los niveles: primero los definidos en `catalogs.org_levels` (por su
 * `sort_order`), luego los romanos que el catálogo no conoce (por valor), luego
 * los que no son romanos (alfabético). "Sin Nivel" lo agrega quien llama al final.
 */
export function compareLevels(a: string, b: string, catalogOrder: ReadonlyMap<string, number> = new Map()): number {
  const rank = (v: string): [number, number | string] => {
    const key = normalizeValue(v);
    const cat = catalogOrder.get(key);
    if (cat !== undefined) return [0, cat];
    const roman = romanToNumber(v);
    if (roman !== null) return [1, roman];
    return [2, key];
  };
  const [ga, va] = rank(a);
  const [gb, vb] = rank(b);
  if (ga !== gb) return ga - gb;
  if (typeof va === 'number' && typeof vb === 'number') return va - vb;
  return collator.compare(String(va), String(vb));
}

const hasFilters = (f: OrgFilters): boolean => Boolean(f.company || f.division || f.area || f.level || f.location);

function fieldMatches(rowValue: string | null, filter: string | undefined): boolean {
  if (!filter) return true;
  const row = normalizeValue(rowValue);
  return filter === NONE_VALUE ? row === '' : row === normalizeValue(filter);
}

export function rowMatches(row: OrgRow, f: OrgFilters): boolean {
  return (
    fieldMatches(row.companyName, f.company) &&
    fieldMatches(row.division, f.division) &&
    fieldMatches(row.area, f.area) &&
    fieldMatches(row.level, f.level) &&
    fieldMatches(row.location, f.location)
  );
}

export interface FilteredRows {
  rows: OrgRow[];
  /** Los que solo están por ser jefes de una coincidencia. */
  contextIds: Set<string>;
  matched: number;
}

/**
 * Un filtro NO corta el árbol: se conservan los que coinciden (todos los filtros
 * a la vez, AND) y, para que la jerarquía siga conectada, la cadena de jefes
 * hacia arriba de cada uno aunque no coincida (esos quedan como "contexto").
 * Los subárboles sin ninguna coincidencia desaparecen.
 *
 * La subida usa un conjunto de visitados: un ciclo en «Reporta a» no puede
 * provocar recursión ni un bucle infinito, y un jefe ausente (inactivo, dado de
 * baja) corta la cadena sin perder al subordinado, que se resolverá como huérfano.
 */
export function filterOrgRows(rows: OrgRow[], filters: OrgFilters): FilteredRows {
  if (!hasFilters(filters)) return { rows, contextIds: new Set(), matched: rows.length };
  const byId = new Map(rows.map((r) => [r.id, r]));
  const matchedIds = new Set(rows.filter((r) => rowMatches(r, filters)).map((r) => r.id));
  const included = new Set<string>(matchedIds);
  for (const id of matchedIds) {
    let cursor = byId.get(id)?.directReportToId ?? null;
    const climbed = new Set<string>([id]);
    while (cursor && byId.has(cursor) && !climbed.has(cursor)) {
      climbed.add(cursor);
      included.add(cursor);
      cursor = byId.get(cursor)?.directReportToId ?? null;
    }
  }
  const contextIds = new Set([...included].filter((id) => !matchedIds.has(id)));
  return { rows: rows.filter((r) => included.has(r.id)), contextIds, matched: matchedIds.size };
}

// ── Opciones de los filtros (cascada con combinaciones reales) ───────────────

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

/** Una combinación real Empresa/División/Área con sus empleados activos (null = vacío). */
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

/** Fila agrupada de la consulta de filtros. */
export interface GroupedRow {
  company: string | null;
  division: string | null;
  area: string | null;
  level: string | null;
  location: string | null;
  count: number;
}

type FieldGroups = Map<string, { display: string | null; count: number }>;

/** Por grupo normalizado: el valor más frecuente como etiqueta (empate: alfabético) y el conteo total. */
function groupField(rows: GroupedRow[], pick: (r: GroupedRow) => string | null): FieldGroups {
  const raw = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const value = pick(r);
    const key = normalizeValue(value);
    const variants = raw.get(key) ?? new Map<string, number>();
    const text = key === '' ? '' : (value as string).trim();
    variants.set(text, (variants.get(text) ?? 0) + r.count);
    raw.set(key, variants);
  }
  const out: FieldGroups = new Map();
  for (const [key, variants] of raw) {
    let best = '';
    let bestCount = -1;
    let total = 0;
    for (const [text, count] of [...variants].sort((a, b) => collator.compare(a[0], b[0]))) {
      total += count;
      if (count > bestCount) {
        best = text;
        bestCount = count;
      }
    }
    out.set(key, { display: key === '' ? null : best, count: total });
  }
  return out;
}

function toOptions(map: FieldGroups, noneLabel: string, sort: (a: string, b: string) => number): FilterOption[] {
  const real = [...map.entries()]
    .filter(([k]) => k !== '')
    .map(([, v]) => ({ value: v.display as string, label: v.display as string, count: v.count }));
  real.sort((a, b) => sort(a.label, b.label));
  const none = map.get('');
  return none ? [...real, { value: NONE_VALUE, label: noneLabel, count: none.count }] : real;
}

/**
 * Valores y conteos de cada filtro más las combinaciones reales
 * Empresa/División/Área, calculados sobre empleados activos. El frontend arma la
 * cascada (empresa → división → área) a partir de las combinaciones, así que solo
 * se ofrecen opciones con resultados.
 */
export function buildFilterOptions(rows: GroupedRow[], catalogLevelOrder: ReadonlyMap<string, number> = new Map()): OrgFilterOptions {
  const company = groupField(rows, (r) => r.company);
  const division = groupField(rows, (r) => r.division);
  const area = groupField(rows, (r) => r.area);
  const level = groupField(rows, (r) => r.level);
  const location = groupField(rows, (r) => r.location);

  const combos = new Map<string, OrgCombination>();
  for (const r of rows) {
    const key = [r.company, r.division, r.area].map(normalizeValue).join('|');
    const existing = combos.get(key);
    if (existing) existing.count += r.count;
    else {
      combos.set(key, {
        company: company.get(normalizeValue(r.company))?.display ?? null,
        division: division.get(normalizeValue(r.division))?.display ?? null,
        area: area.get(normalizeValue(r.area))?.display ?? null,
        count: r.count,
      });
    }
  }

  const alpha = (a: string, b: string) => collator.compare(a, b);
  return {
    total: rows.reduce((a, r) => a + r.count, 0),
    companies: toOptions(company, 'Sin Empresa', alpha),
    divisions: toOptions(division, 'Sin División', alpha),
    areas: toOptions(area, 'Sin Área', alpha),
    levels: toOptions(level, 'Sin Nivel', (a, b) => compareLevels(a, b, catalogLevelOrder)),
    locations: toOptions(location, 'Sin Ubicación', alpha),
    combinations: [...combos.values()],
  };
}
