/**
 * Dibuja el organigrama en un PDF vectorial con `pdf-lib` (texto seleccionable, líneas trazadas, fuentes
 * estándar sin incrustar: archivos de pocos KB). Corre en el navegador con lo que ya está en pantalla.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { levelLabel, type OrgView } from './org-filters';
import { bandEdgePath, type BandLayout } from './org-bands';
import { isSynthetic, type OrgPerson, type OrgTreeNode } from './org-tree';
import {
  FOOTER_H,
  HEADER_H,
  MARGIN,
  PAPERS,
  PDF_LAYOUT,
  contentArea,
  generatedAtText,
  planPages,
  viewLabel,
  type ChartPage,
  type IndexPage,
  type PaperKey,
} from './org-pdf-plan';

export interface OrgPdfInput {
  /** Árbol tal como se ve (con lo contraído y la rama enfocada ya aplicados). */
  root: OrgTreeNode;
  view: OrgView;
  paper: PaperKey;
  /** Orden de los niveles del catálogo (para las bandas de «Por Niveles»). */
  preferredLevels: string[];
  filtersText: string;
  counts: { matched: number; total: number };
  /** Fecha del servidor (ISO); se muestra en America/Mexico_City. */
  generatedAt: string;
  organization: string;
  /** Descendientes ocultos de un nodo contraído (para el «+N» de la tarjeta). */
  hiddenCount: (id: string) => number;
}

const C = {
  ink: rgb(0.06, 0.09, 0.16),
  gray: rgb(0.39, 0.45, 0.55),
  line: rgb(0.58, 0.64, 0.72),
  border: rgb(0.45, 0.52, 0.62),
  pill: rgb(0.9, 0.93, 0.96),
  band: rgb(0.945, 0.96, 0.975),
  white: rgb(1, 1, 1),
};

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Cambia por «?» lo que la fuente estándar (WinAnsi: acentos y ñ incluidos) no puede escribir. */
function safe(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

/** Recorta con «...» para que quepa en `max` puntos. */
function fit(font: PDFFont, text: string, size: number, max: number): string {
  const t = safe(font, text);
  if (font.widthOfTextAtSize(t, size) <= max) return t;
  let cut = t;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

/** Parte un texto en líneas de ancho `max` (máximo `maxLines`; la última se recorta). */
function wrap(font: PDFFont, text: string, size: number, max: number, maxLines: number): string[] {
  const words = safe(font, text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= max || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fit(font, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, size, max);
    return kept;
  }
  return lines;
}

/** Rectángulo redondeado como camino SVG (w × h, esquinas de radio r). */
function roundedRect(w: number, h: number, r: number): string {
  const c = r * 0.5523;
  return (
    `M${r},0 H${w - r} C${w - r + c},0 ${w},${r - c} ${w},${r} V${h - r} C${w},${h - r + c} ${w - r + c},${h} ${w - r},${h} ` +
    `H${r} C${r - c},${h} 0,${h - r + c} 0,${h - r} V${r} C0,${r - c} ${r - c},0 ${r},0 Z`
  );
}

function drawCard(page: PDFPage, fonts: Fonts, node: OrgTreeNode, left: number, top: number, s: number, hidden: number): void {
  const { nodeWidth: w, nodeHeight: h } = PDF_LAYOUT;
  const text = (t: string, x: number, y: number, size: number, font: PDFFont, color = C.ink) =>
    page.drawText(t, { x: left + x * s, y: top - y * s, size: size * s, font, color });

  if (isSynthetic(node)) {
    page.drawSvgPath(roundedRect(w, h, 12), { x: left, y: top, scale: s, color: C.white, borderColor: C.border, borderWidth: Math.max(0.6, s), borderDashArray: [4, 3] });
    const label = safe(fonts.bold, node.fullName);
    const size = 12 * s;
    page.drawText(label, { x: left + (w * s - fonts.bold.widthOfTextAtSize(label, size)) / 2, y: top - (h / 2 + 4) * s, size, font: fonts.bold, color: C.gray });
    if (hidden > 0) text(`+${hidden}`, w / 2 - 8, h - 8, 8, fonts.bold, C.gray);
    return;
  }

  const person = node as OrgPerson;
  page.drawSvgPath(roundedRect(w, h, 10), { x: left, y: top, scale: s, color: C.white, borderColor: C.border, borderWidth: Math.max(0.6, s) });
  const pad = 10;
  const max = w - pad * 2;
  const level = levelLabel(person.level);
  if (level) {
    const size = 8;
    const lw = fonts.bold.widthOfTextAtSize(safe(fonts.bold, level), size);
    page.drawSvgPath(roundedRect(lw + 10, 13, 6.5), { x: left + (w - pad - lw - 10) * s, y: top - 8 * s, scale: s, color: C.pill });
    text(safe(fonts.bold, level), w - pad - lw - 5, 17.5, size, fonts.bold, C.gray);
  }
  text(fit(fonts.bold, person.fullName, 12, max), pad, 38, 12, fonts.bold);
  text(fit(fonts.regular, person.position, 10, max), pad, 54, 10, fonts.regular);
  if (person.area) text(fit(fonts.regular, person.area, 8.5, max), pad, 69, 8.5, fonts.regular, C.gray);
  if (hidden > 0) {
    const label = `+${hidden}`;
    const lw = fonts.bold.widthOfTextAtSize(label, 8);
    page.drawSvgPath(roundedRect(lw + 12, 14, 7), { x: left + (w / 2 - (lw + 12) / 2) * s, y: top - (h - 7) * s, scale: s, color: C.white, borderColor: C.border, borderWidth: Math.max(0.5, 0.8 * s) });
    text(label, w / 2 - lw / 2, h + 3, 8, fonts.bold, C.gray);
  }
}

function drawHeader(page: PDFPage, fonts: Fonts, input: OrgPdfInput, subtitle: string | null): void {
  const { width, height } = PAPERS[input.paper];
  const right = width - MARGIN;
  page.drawText('Organigrama', { x: MARGIN, y: height - MARGIN - 14, size: 17, font: fonts.bold, color: C.ink });
  const stamp = `Generado: ${generatedAtText(input.generatedAt)}`;
  page.drawText(stamp, { x: right - fonts.regular.widthOfTextAtSize(stamp, 8.5), y: height - MARGIN - 12, size: 8.5, font: fonts.regular, color: C.gray });
  const lines = wrap(fonts.regular, input.filtersText, 9, width - MARGIN * 2, 2);
  lines.forEach((l, i) => page.drawText(l, { x: MARGIN, y: height - MARGIN - 28 - i * 11, size: 9, font: fonts.regular, color: C.ink }));
  const meta = `Vista: ${viewLabel(input.view)} · Mostrando ${input.counts.matched} de ${input.counts.total} Colaboradores${subtitle ? ` · ${subtitle}` : ''}`;
  page.drawText(fit(fonts.regular, meta, 8.5, width - MARGIN * 2), { x: MARGIN, y: height - MARGIN - 28 - lines.length * 11 - 2, size: 8.5, font: fonts.regular, color: C.gray });
  const y = height - MARGIN - HEADER_H + 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.6, color: C.line });
}

function drawFooter(page: PDFPage, fonts: Fonts, input: OrgPdfInput, n: number, total: number): void {
  const { width } = PAPERS[input.paper];
  const y = MARGIN + 4;
  page.drawLine({ start: { x: MARGIN, y: y + 12 }, end: { x: width - MARGIN, y: y + 12 }, thickness: 0.6, color: C.line });
  page.drawText(safe(fonts.regular, input.organization), { x: MARGIN, y, size: 8.5, font: fonts.regular, color: C.gray });
  const label = `Página ${n} de ${total}`;
  page.drawText(label, { x: width - MARGIN - fonts.regular.widthOfTextAtSize(label, 8.5), y, size: 8.5, font: fonts.regular, color: C.gray });
}

function drawChart(page: PDFPage, fonts: Fonts, input: OrgPdfInput, plan: ChartPage): void {
  const { width, height } = PAPERS[input.paper];
  const area = contentArea(input.paper);
  const s = plan.scale;
  const top = height - MARGIN - HEADER_H;
  const ox = MARGIN + (area.width - plan.layout.width * s) / 2;
  const levels = input.view === 'levels' && 'bands' in plan.layout ? (plan.layout as BandLayout).bands : [];

  // Bandas (Por Niveles): fondo alterno a todo lo ancho y etiqueta a la izquierda.
  levels.forEach((b, i) => {
    const bandTop = top - b.top * s;
    if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: bandTop - b.height * s, width: width - MARGIN * 2, height: b.height * s, color: C.band });
    page.drawLine({ start: { x: MARGIN, y: bandTop - b.height * s }, end: { x: width - MARGIN, y: bandTop - b.height * s }, thickness: 0.4, color: C.line });
    page.drawText(safe(fonts.bold, b.label), { x: MARGIN + 4, y: bandTop - 12, size: 8.5, font: fonts.bold, color: C.gray });
  });

  // Conexiones.
  const positions = new Map(plan.layout.nodes.map((n) => [n.id, n]));
  const stroke = { borderColor: C.line, borderWidth: Math.max(0.6, 1.1 * s) };
  for (const n of plan.layout.nodes) {
    if (!n.parentId) continue;
    const parent = positions.get(n.parentId);
    if (!parent) continue;
    const { nodeWidth: w, nodeHeight: h } = PDF_LAYOUT;
    const d =
      input.view === 'levels'
        ? bandEdgePath(parent, n, { width: w, height: h })
        : `M${parent.x + w / 2},${parent.y + h} V${(parent.y + h + n.y) / 2} H${n.x + w / 2} V${n.y}`;
    page.drawSvgPath(d, { x: ox, y: top, scale: s, ...stroke });
  }

  // Tarjetas encima de las líneas.
  const nodeById = new Map<string, OrgTreeNode>();
  const stack: OrgTreeNode[] = [plan.tree];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    nodeById.set(cur.id, cur);
    stack.push(...cur.children);
  }
  for (const n of plan.layout.nodes) {
    const node = nodeById.get(n.id);
    if (node) drawCard(page, fonts, node, ox + n.x * s, top - n.y * s, s, input.hiddenCount(n.id));
  }
}

function drawIndex(page: PDFPage, fonts: Fonts, input: OrgPdfInput, plan: IndexPage): void {
  const { width, height } = PAPERS[input.paper];
  const top = height - MARGIN - HEADER_H - 8;
  page.drawText('Índice de Páginas', { x: MARGIN, y: top - 12, size: 13, font: fonts.bold, color: C.ink });
  page.drawText(safe(fonts.regular, 'El organigrama no cabe en una página con letra legible: se reparte por ramas. El jefe de cada rama se repite en su página como referencia.'), {
    x: MARGIN, y: top - 28, size: 9, font: fonts.regular, color: C.gray,
  });
  const lineH = 15;
  const startY = top - 52;
  const perColumn = Math.max(1, Math.floor((startY - (MARGIN + FOOTER_H)) / lineH));
  const columns = Math.max(1, Math.ceil(plan.entries.length / perColumn));
  const colW = (width - MARGIN * 2) / Math.min(columns, input.paper === 'a3' ? 3 : 2);
  const visible = plan.entries.slice(0, perColumn * (input.paper === 'a3' ? 3 : 2));
  visible.forEach((e, i) => {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const x = MARGIN + col * colW;
    const y = startY - row * lineH;
    const label = `Pág. ${e.page}`;
    page.drawText(label, { x, y, size: 9, font: fonts.bold, color: C.ink });
    page.drawText(fit(fonts.regular, `${e.label} (${e.people} ${e.people === 1 ? 'persona' : 'personas'})`, 9, colW - 52), { x: x + 40, y, size: 9, font: fonts.regular, color: C.ink });
  });
  if (visible.length < plan.entries.length) {
    page.drawText(`... y ${plan.entries.length - visible.length} páginas más`, { x: MARGIN, y: MARGIN + FOOTER_H, size: 9, font: fonts.regular, color: C.gray });
  }
}

/** Genera el PDF. Devuelve los bytes y las páginas (con la escala de cada una, para pruebas y reporte). */
export async function buildOrgPdf(input: OrgPdfInput): Promise<{ bytes: Uint8Array; pages: ReturnType<typeof planPages> }> {
  const plan = planPages(input.root, input.view, input.paper, input.preferredLevels);
  const doc = await PDFDocument.create();
  const fonts: Fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  doc.setTitle('Organigrama');
  doc.setSubject(input.filtersText);
  doc.setCreator(input.organization);
  doc.setProducer(input.organization);
  doc.setCreationDate(new Date(input.generatedAt));
  const { width, height } = PAPERS[input.paper];

  plan.forEach((p, i) => {
    const page = doc.addPage([width, height]);
    drawHeader(page, fonts, input, p.kind === 'chart' ? p.subtitle : null);
    if (p.kind === 'index') drawIndex(page, fonts, input, p);
    else drawChart(page, fonts, input, p);
    drawFooter(page, fonts, input, i + 1, plan.length);
  });
  return { bytes: await doc.save(), pages: plan };
}

