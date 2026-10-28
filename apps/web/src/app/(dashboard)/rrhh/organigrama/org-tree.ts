/**
 * Lógica pura del organigrama (sin React): recorridos, contraer/expandir,
 * búsqueda y el acomodo (layout) del árbol. Se prueba aparte.
 */

export interface OrgPerson {
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
  children: OrgPerson[];
}

/** Nodo neutro "Organización" que agrupa varias raíces; no es una persona. */
export interface OrgSynthetic {
  id: 'organization';
  synthetic: true;
  fullName: 'Organización';
  children: OrgPerson[];
}

export type OrgTreeNode = OrgPerson | OrgSynthetic;

export const ORGANIZATION_ID = 'organization';

export function isSynthetic(node: OrgTreeNode): node is OrgSynthetic {
  return 'synthetic' in node && node.synthetic === true;
}

/** Sin mayúsculas ni acentos: "álvarez" encuentra "Alvarez". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Todos los nodos, de arriba abajo. */
export function flatten(root: OrgTreeNode | null): OrgTreeNode[] {
  if (!root) return [];
  const out: OrgTreeNode[] = [];
  const stack: OrgTreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.push(node);
    for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]!);
  }
  return out;
}

export function findNode(root: OrgTreeNode | null, id: string): OrgTreeNode | null {
  return flatten(root).find((n) => n.id === id) ?? null;
}

/** Ids de los ancestros de un nodo (de la raíz hacia abajo, sin incluirlo). */
export function ancestorsOf(root: OrgTreeNode | null, id: string): string[] {
  if (!root) return [];
  const walk = (node: OrgTreeNode, path: string[]): string[] | null => {
    if (node.id === id) return path;
    for (const child of node.children) {
      const found = walk(child, [...path, node.id]);
      if (found) return found;
    }
    return null;
  };
  return walk(root, []) ?? [];
}

/** Cantidad de descendientes (a cualquier nivel). */
export function descendantCount(node: OrgTreeNode): number {
  return flatten(node).length - 1;
}

/**
 * Vista inicial: abierto hasta el segundo nivel. Se contraen los nodos con hijos
 * cuya profundidad es `openDepth` o mayor (la raíz está en profundidad 0).
 */
export function defaultCollapsed(root: OrgTreeNode | null, openDepth = 2): Set<string> {
  const collapsed = new Set<string>();
  if (!root) return collapsed;
  const stack: { node: OrgTreeNode; depth: number }[] = [{ node: root, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (node.children.length > 0 && depth >= openDepth) collapsed.add(node.id);
    for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
  }
  return collapsed;
}

/** "Contraer todo": solo queda visible la raíz y sus hijos directos. */
export function allCollapsed(root: OrgTreeNode | null): Set<string> {
  return new Set(flatten(root).filter((n) => n.children.length > 0 && n.id !== root?.id).map((n) => n.id));
}

/** Nodos cuyo nombre contiene el texto buscado (sin acentos ni mayúsculas). El nodo neutro no se busca. */
export function searchNodes(root: OrgTreeNode | null, query: string, limit = 8): OrgPerson[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  return flatten(root)
    .filter((n): n is OrgPerson => !isSynthetic(n) && normalize(n.fullName).includes(q))
    .slice(0, limit);
}

/** Árbol con los nodos contraídos sin hijos visibles. No muta el original. */
export function visibleTree(node: OrgTreeNode, collapsed: Set<string>): OrgTreeNode {
  if (collapsed.has(node.id)) return { ...node, children: [] } as OrgTreeNode;
  return { ...node, children: node.children.map((c) => visibleTree(c, collapsed) as OrgPerson) } as OrgTreeNode;
}

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
}

export interface PositionedNode {
  id: string;
  /** Esquina superior izquierda. */
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
}

export interface Layout {
  nodes: PositionedNode[];
  width: number;
  height: number;
}

/**
 * Acomodo por capas: cada nivel en su fila; un padre queda centrado sobre sus
 * hijos y las hojas se reparten de izquierda a derecha sin encimarse.
 */
export function layoutTree(root: OrgTreeNode, config: LayoutConfig): Layout {
  const { nodeWidth, nodeHeight, gapX, gapY } = config;

  // Ancho que ocupa cada subárbol.
  const widths = new Map<string, number>();
  const measure = (node: OrgTreeNode): number => {
    const own =
      node.children.length === 0
        ? nodeWidth
        : Math.max(nodeWidth, node.children.reduce((sum, c) => sum + measure(c), 0) + gapX * (node.children.length - 1));
    widths.set(node.id, own);
    return own;
  };
  measure(root);

  const nodes: PositionedNode[] = [];
  let maxDepth = 0;
  const place = (node: OrgTreeNode, left: number, depth: number, parentId: string | null) => {
    const width = widths.get(node.id)!;
    nodes.push({
      id: node.id,
      x: left + (width - nodeWidth) / 2,
      y: depth * (nodeHeight + gapY),
      depth,
      parentId,
    });
    maxDepth = Math.max(maxDepth, depth);
    let cursor = left;
    for (const child of node.children) {
      place(child, cursor, depth + 1, node.id);
      cursor += widths.get(child.id)! + gapX;
    }
  };
  place(root, 0, 0, null);

  return { nodes, width: widths.get(root.id)!, height: (maxDepth + 1) * nodeHeight + maxDepth * gapY };
}

/** Escala y desplazamiento que centran el árbol completo en un viewport. */
export function fitTransform(
  layoutSize: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 32,
  maxScale = 1,
): { x: number; y: number; k: number } {
  if (layoutSize.width <= 0 || layoutSize.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0, k: 1 };
  }
  const k = Math.min(
    (viewport.width - padding * 2) / layoutSize.width,
    (viewport.height - padding * 2) / layoutSize.height,
    maxScale,
  );
  const scale = Math.max(k, 0.05);
  return {
    k: scale,
    x: (viewport.width - layoutSize.width * scale) / 2,
    y: Math.min(padding, (viewport.height - layoutSize.height * scale) / 2),
  };
}

/** Transformación que lleva el centro de un nodo al centro del viewport. */
export function centerOn(
  node: { x: number; y: number },
  config: Pick<LayoutConfig, 'nodeWidth' | 'nodeHeight'>,
  viewport: { width: number; height: number },
  k: number,
): { x: number; y: number; k: number } {
  return {
    k,
    x: viewport.width / 2 - (node.x + config.nodeWidth / 2) * k,
    y: viewport.height / 2 - (node.y + config.nodeHeight / 2) * k,
  };
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2;

export function clampScale(k: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, k));
}
