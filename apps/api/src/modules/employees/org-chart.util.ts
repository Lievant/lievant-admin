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
  photoUrl: string | null;
  corporateEmail: string | null;
  phone?: string | null;
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

export const ORGANIZATION_ID = 'organization';

/**
 * URL de la foto. Se reutiliza el mecanismo de avatares del sistema
 * (/api/users/:correo/photo, que cachea la respuesta de Microsoft Graph); no se
 * llama a Graph desde aquí ni se guardan fotos nuevas.
 */
export function photoUrlFor(email: string | null): string | null {
  return email ? `/api/users/${encodeURIComponent(email)}/photo` : null;
}

function toNode(row: OrgRow, showPhone: boolean): OrgNode {
  const node: OrgNode = {
    id: row.id,
    displayId: row.displayId,
    fullName: row.fullName,
    position: row.position,
    area: row.area,
    photoUrl: photoUrlFor(row.corporateEmail),
    corporateEmail: row.corporateEmail,
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
  options: { showPhone?: boolean; onCycle?: (message: string) => void } = {},
): OrgTreeResult {
  const showPhone = options.showPhone ?? ORG_CHART_SHOW_PHONE;
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
    const rootNode = toNode(row, showPhone);
    const stack: { row: OrgRow; node: OrgNode }[] = [{ row, node: rootNode }];
    while (stack.length > 0) {
      const { row: r, node } = stack.pop()!;
      for (const child of childrenOf.get(r.id) ?? []) {
        const childNode = toNode(child, showPhone);
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
