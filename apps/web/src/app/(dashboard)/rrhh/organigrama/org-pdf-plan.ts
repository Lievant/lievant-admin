/**
 * Exportar el organigrama a PDF: papel, filtros en texto y reparto en páginas (sin React ni pdf-lib; se prueba aparte).
 *
 * Regla: el organigrama visible se dibuja a escala uniforme. Si cabe en una página con letra legible
 * (`MIN_SCALE`) va en una sola. Si no, se parte por ramas del primer nivel (el jefe se repite en cada página como
 * referencia) y, si una rama sola no cabe, se baja un nivel. Una tarjeta nunca se parte: cada página es un
 * árbol completo escalado.
 */
import { formatDateTimeMx } from '../matriz-puestos/positions-constants';
import { NONE_VALUE, levelLabel, type OrgSelection, type OrgView } from './org-filters';
import { layoutByLevels, type BandLayout } from './org-bands';
import { isSynthetic, layoutTree, type Layout, type LayoutConfig, type OrgPerson, type OrgTreeNode } from './org-tree';

export type PaperKey = 'carta' | 'a3';

/** Carta y A3 en horizontal, en puntos (1 pt = 1/72 in). */
export const PAPERS: Record<PaperKey, { label: string; width: number; height: number }> = {
  carta: { label: 'Carta', width: 792, height: 612 },
  a3: { label: 'A3', width: 1190.55, height: 841.89 },
};

export const MARGIN = 30;
export const HEADER_H = 64;
export const FOOTER_H = 26;

/** Mismo acomodo que la pantalla (tarjetas de 208 × 92). */
export const PDF_LAYOUT: LayoutConfig = { nodeWidth: 208, nodeHeight: 92, gapX: 24, gapY: 48 };

/**
 * Escala mínima para considerar legible una página: con las fuentes de la tarjeta (nombre 12 pt, cargo 10 pt,
 * área 8.5 pt a escala 1) queda en 6.6 / 5.5 / 4.7 pt. Por debajo se reparte en más páginas.
 */
export const MIN_SCALE = 0.55;
/** Nunca se agranda más que la pantalla. */
export const MAX_SCALE = 1;

export interface Area {
  width: number;
  height: number;
}

/** Zona de dibujo de una página (sin márgenes, encabezado ni pie). */
export function contentArea(paper: PaperKey): Area {
  const p = PAPERS[paper];
  return { width: p.width - MARGIN * 2, height: p.height - MARGIN * 2 - HEADER_H - FOOTER_H };
}

export function layoutOf(view: OrgView, tree: OrgTreeNode, preferredLevels: string[] = []): Layout | BandLayout {
  return view === 'levels' ? layoutByLevels(tree, PDF_LAYOUT, preferredLevels) : layoutTree(tree, PDF_LAYOUT);
}

/** Escala con que el layout cabe en el área (sin pasar de `MAX_SCALE`). */
export function fitScale(layout: { width: number; height: number }, area: Area): number {
  if (layout.width <= 0 || layout.height <= 0) return MAX_SCALE;
  return Math.min(area.width / layout.width, area.height / layout.height, MAX_SCALE);
}

export function countPeople(node: OrgTreeNode): number {
  let n = 0;
  const stack: OrgTreeNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (!isSynthetic(cur)) n += 1;
    stack.push(...cur.children);
  }
  return n;
}

export interface ChartPage {
  kind: 'chart';
  tree: OrgTreeNode;
  layout: Layout | BandLayout;
  scale: number;
  /** Texto bajo el encabezado: de qué rama es la página (null si es el organigrama completo). */
  subtitle: string | null;
  people: number;
  /** false si ni repartiendo en ramas se llega a la escala mínima (un jefe con muchísimos directos). */
  legible: boolean;
}

export interface IndexPage {
  kind: 'index';
  entries: { page: number; label: string; people: number }[];
}

export type PlannedPage = ChartPage | IndexPage;

const withChildren = (node: OrgTreeNode, children: OrgPerson[]): OrgTreeNode => ({ ...node, children }) as OrgTreeNode;

const names = (list: OrgPerson[]): string => {
  const first = list.slice(0, 3).map((p) => p.fullName);
  return first.join(', ') + (list.length > 3 ? ` y ${list.length - 3} más` : '');
};

/**
 * Reparto en páginas. Con una sola página de organigrama no hay índice; con varias, la página 1 es un índice
 * de ramas con su número de página y las demás son los organigramas.
 */
export function planPages(root: OrgTreeNode, view: OrgView, paper: PaperKey, preferredLevels: string[] = []): PlannedPage[] {
  const area = contentArea(paper);
  const layoutFor = (tree: OrgTreeNode) => layoutOf(view, tree, preferredLevels);
  const scaleOf = (tree: OrgTreeNode) => fitScale(layoutFor(tree), area);
  const charts: ChartPage[] = [];

  const push = (tree: OrgTreeNode, subtitle: string | null) => {
    const layout = layoutFor(tree);
    const scale = fitScale(layout, area);
    charts.push({ kind: 'chart', tree, layout, scale, subtitle, people: countPeople(tree), legible: scale >= MIN_SCALE });
  };

  /** Cadena de jefes de arriba hacia abajo, cada uno con un solo hijo (el siguiente): así ningún jefe se pierde. */
  const chained = (chain: OrgTreeNode[], tree: OrgTreeNode): OrgTreeNode =>
    chain.reduceRight<OrgTreeNode>((below, boss) => withChildren(boss, [below as OrgPerson]), tree);

  const split = (node: OrgTreeNode, chain: OrgTreeNode[]) => {
    const subtitleOf = (list: OrgPerson[]) => `Rama de ${node.fullName}: ${names(list)}`;
    if (node.children.length === 0 || scaleOf(chained(chain, node)) >= MIN_SCALE) {
      push(chained(chain, node), chain.length > 0 ? `Rama de ${node.fullName}` : null);
      return;
    }
    // Ramas del primer nivel, agrupadas mientras sigan cabiendo con letra legible (el jefe va en todas).
    const groups: OrgPerson[][] = [];
    let current: OrgPerson[] = [];
    for (const child of node.children) {
      if (current.length > 0 && scaleOf(chained(chain, withChildren(node, [...current, child]))) < MIN_SCALE) {
        groups.push(current);
        current = [];
      }
      current.push(child);
    }
    if (current.length > 0) groups.push(current);

    for (const group of groups) {
      const tree = chained(chain, withChildren(node, group));
      if (scaleOf(tree) >= MIN_SCALE || group.length > 1 || group[0]!.children.length === 0) {
        push(tree, subtitleOf(group));
      } else {
        // Una rama sola que no cabe: se baja un nivel y los jefes de arriba se repiten como referencia.
        split(group[0]!, [...chain, node]);
      }
    }
  };

  split(root, []);
  if (charts.length === 1) return charts;
  const entries = charts.map((c, i) => ({ page: i + 2, label: c.subtitle ?? 'Organigrama', people: c.people }));
  return [{ kind: 'index', entries }, ...charts];
}

/** «Empresa: Lievant · División: E-Commerce» o «Sin filtros». */
export function filtersText(sel: OrgSelection): string {
  const part = (label: string, value: string, none: string): string | null =>
    value === '' ? null : `${label}: ${value === NONE_VALUE ? none : value}`;
  const parts = [
    part('Empresa', sel.company, 'Sin Empresa'),
    part('División', sel.division, 'Sin División'),
    part('Área', sel.area, 'Sin Área'),
    sel.level === '' ? null : `Nivel: ${sel.level === NONE_VALUE ? 'Sin Nivel' : levelLabel(sel.level).replace(/^Nivel /, '')}`,
    part('Ubicación', sel.location, 'Sin Ubicación'),
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : 'Sin filtros';
}

export const viewLabel = (view: OrgView): string => (view === 'levels' ? 'Por Niveles' : 'Jerarquía');

/** Fecha y hora de generación en America/Mexico_City: «28/10/2026 13:45». */
export const generatedAtText = (iso: string): string => formatDateTimeMx(iso);

/** Nombre del archivo: Organigrama_2026-10-28.pdf (fecha de México). */
export function pdfFileName(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return `Organigrama_${parts}.pdf`;
}
