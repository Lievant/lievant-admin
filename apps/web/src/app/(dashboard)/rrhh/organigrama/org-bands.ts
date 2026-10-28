/**
 * Vista "Por Niveles" del organigrama (sin React): una banda horizontal por nivel,
 * con el nivel I arriba. La posición horizontal sale del mismo acomodo del árbol
 * (`layoutTree`) y la vertical del nivel de cada persona; los choques dentro de
 * una banda se resuelven separando los nodos. Se prueba aparte.
 */
import { NONE_VALUE, levelLabel, normalizeValue } from './org-filters';
import { isSynthetic, layoutTree, type Layout, type LayoutConfig, type OrgTreeNode } from './org-tree';

export interface Band {
  key: string;
  /** "Nivel II", "Sin Nivel". */
  label: string;
  /** Esquina superior de la banda y su alto (en coordenadas del layout). */
  top: number;
  height: number;
}

export interface BandLayout extends Layout {
  bands: Band[];
}

const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function romanValue(key: string): number | null {
  const v = key.replace(/\s+/g, '').toUpperCase();
  if (v === '' || !ROMAN.test(v)) return null;
  let total = 0;
  for (let i = 0; i < v.length; i++) {
    const cur = ROMAN_VALUES[v[i]!]!;
    const next = i + 1 < v.length ? ROMAN_VALUES[v[i + 1]!]! : 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

/** Clave de banda de un nivel: normalizado ("II", " ii " → "ii"); vacío → "Sin Nivel". */
export function levelKey(level: string | null | undefined): string {
  const n = normalizeValue(level);
  return n === '' ? NONE_VALUE : n;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/**
 * Orden de las bandas, igual que las opciones del filtro de nivel: primero los del
 * catálogo (en el orden que llega de las opciones), luego los romanos fuera del
 * catálogo por valor, luego los no romanos por orden alfabético y "Sin Nivel" al final.
 */
export function orderBandKeys(keys: string[], preferredOrder: string[] = []): string[] {
  const preferred = new Map(preferredOrder.map((k, i) => [levelKey(k), i]));
  const rank = (k: string): [number, number | string] => {
    if (k === NONE_VALUE) return [3, 0];
    const p = preferred.get(k);
    if (p !== undefined) return [0, p];
    const r = romanValue(k);
    if (r !== null) return [1, r];
    return [2, k];
  };
  return [...new Set(keys)].sort((a, b) => {
    const [ga, va] = rank(a);
    const [gb, vb] = rank(b);
    if (ga !== gb) return ga - gb;
    return typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va), String(vb));
  });
}

/**
 * Acomodo por niveles. El nodo "Organización" (si existe) va en una fila superior
 * sin etiqueta; solo se dibujan las bandas con al menos un nodo visible.
 */
export function layoutByLevels(root: OrgTreeNode, config: LayoutConfig, preferredOrder: string[] = []): BandLayout {
  const { nodeWidth, nodeHeight, gapX, gapY } = config;
  const base = layoutTree(root, config);
  const nodeById = new Map<string, OrgTreeNode>();
  const stack: OrgTreeNode[] = [root];
  while (stack.length > 0) {
    const n = stack.pop()!;
    nodeById.set(n.id, n);
    stack.push(...n.children);
  }

  const keyOf = (id: string): string | null => {
    const node = nodeById.get(id);
    return !node || isSynthetic(node) ? null : levelKey(node.level);
  };
  const hasSynthetic = base.nodes.some((n) => keyOf(n.id) === null);
  const order = orderBandKeys(base.nodes.map((n) => keyOf(n.id)).filter((k): k is string => k !== null), preferredOrder);
  const firstRow = hasSynthetic ? 1 : 0;
  const rowOfKey = new Map(order.map((k, i) => [k, firstRow + i]));
  const pitch = nodeHeight + gapY;

  // Fila de cada nodo y choques: dentro de una fila se ordena por x y se separa lo que quede más cerca que el mínimo.
  const rows = new Map<number, { id: string; x: number }[]>();
  for (const n of base.nodes) {
    const k = keyOf(n.id);
    const row = k === null ? 0 : rowOfKey.get(k)!;
    const list = rows.get(row) ?? [];
    list.push({ id: n.id, x: n.x });
    rows.set(row, list);
  }
  const xOf = new Map<string, number>();
  const minStep = nodeWidth + gapX;
  for (const list of rows.values()) {
    list.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    let cursor = -Infinity;
    for (const item of list) {
      const x = Math.max(item.x, cursor);
      xOf.set(item.id, x);
      cursor = x + minStep;
    }
  }

  const rowCount = firstRow + order.length;
  const nodes = base.nodes.map((n) => {
    const k = keyOf(n.id);
    const row = k === null ? 0 : rowOfKey.get(k)!;
    return { ...n, x: xOf.get(n.id)!, y: row * pitch + gapY / 2, depth: row };
  });
  const labelFor = (key: string): string => {
    if (key === NONE_VALUE) return 'Sin Nivel';
    const sample = [...nodeById.values()].find((n) => !isSynthetic(n) && levelKey(n.level) === key);
    return sample && !isSynthetic(sample) ? levelLabel(sample.level) : key;
  };
  const bands: Band[] = order.map((key, i) => ({ key, label: labelFor(key), top: (firstRow + i) * pitch, height: pitch }));
  const width = Math.max(nodeWidth, ...nodes.map((n) => n.x + nodeWidth));
  return { nodes, width, height: rowCount * pitch, bands };
}

/** Curva entre un padre y su hijo en la vista por niveles (el hijo puede quedar arriba, abajo o en la misma banda). */
export function bandEdgePath(
  parent: { x: number; y: number },
  child: { x: number; y: number },
  size: { width: number; height: number },
): string {
  const px = parent.x + size.width / 2;
  const cx = child.x + size.width / 2;
  if (child.y > parent.y) {
    const y1 = parent.y + size.height;
    const my = (y1 + child.y) / 2;
    return `M${px},${y1} C${px},${my} ${cx},${my} ${cx},${child.y}`;
  }
  if (child.y < parent.y) {
    const y2 = child.y + size.height;
    const my = (parent.y + y2) / 2;
    return `M${px},${parent.y} C${px},${my} ${cx},${my} ${cx},${y2}`;
  }
  const lift = 20;
  return `M${px},${parent.y} C${px},${parent.y - lift} ${cx},${child.y - lift} ${cx},${child.y}`;
}
