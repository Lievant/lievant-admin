import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildOrgPdf } from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-pdf';
import {
  MAX_SCALE,
  MIN_SCALE,
  PAPERS,
  contentArea,
  countPeople,
  filtersText,
  fitScale,
  generatedAtText,
  pdfFileName,
  planPages,
  type ChartPage,
  type PaperKey,
} from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-pdf-plan';
import { EMPTY_SELECTION, NONE_VALUE } from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-filters';
import type { OrgPerson, OrgTreeNode } from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-tree';

let seq = 0;
const person = (name: string, level: string | null, children: OrgPerson[] = [], position = 'Cargo', area: string | null = 'TEST-Área'): OrgPerson => {
  seq += 1;
  return { id: `p${seq}`, displayId: `E${seq}`, fullName: name, position, area, level, companyName: 'TEST-Lievant', division: 'TEST-Tecnología', photoUrl: null, corporateEmail: null, children };
};
const org = (children: OrgPerson[]): OrgTreeNode => ({ id: 'organization', synthetic: true, fullName: 'Organización', children }) as OrgTreeNode;
const small = () => person('TEST-Dirección', 'IV', [person('TEST-Gerente TI', 'III', [person('TEST-Analista', 'II'), person('TEST-Becario', 'I')]), person('TEST-Gerente Ventas', 'III')]);
/** Director → 6 jefes → 4 gerentes → 5 colaboradores: 151 personas, muy ancho. */
const big = () =>
  person('TEST-Director General', 'IV', Array.from({ length: 6 }, (_, d) =>
    person(`TEST-Director ${d + 1}`, 'III', Array.from({ length: 4 }, (_, m) =>
      person(`TEST-Gerente ${d + 1}.${m + 1}`, 'III', Array.from({ length: 5 }, (_, e) => person(`TEST-Colaborador ${d + 1}.${m + 1}.${e + 1}`, e % 2 ? 'I' : null)))))));

const ids = (node: OrgTreeNode): string[] => [node.id, ...node.children.flatMap((c) => ids(c))];
const charts = (pages: ReturnType<typeof planPages>): ChartPage[] => pages.filter((p): p is ChartPage => p.kind === 'chart');
const EPS = 0.001;

describe('Organigrama PDF · reparto en páginas', () => {
  it('uno chico cabe en una sola página, sin índice, a escala legible', () => {
    const pages = planPages(small(), 'hierarchy', 'carta');
    expect(pages).toHaveLength(1);
    expect(pages[0]!.kind).toBe('chart');
    const c = pages[0] as ChartPage;
    expect(c.subtitle).toBeNull();
    expect(c.scale).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(c.scale).toBeLessThanOrEqual(MAX_SCALE);
  });

  it('nunca se agranda más que la pantalla y siempre cabe en el área (ninguna tarjeta queda cortada)', () => {
    for (const paper of ['carta', 'a3'] as PaperKey[]) {
      const area = contentArea(paper);
      for (const view of ['hierarchy', 'levels'] as const) {
        for (const root of [small(), big(), org([small(), small(), small()])]) {
          for (const page of charts(planPages(root, view, paper, ['I', 'II', 'III', 'IV']))) {
            expect(page.scale).toBeLessThanOrEqual(MAX_SCALE + EPS);
            expect(page.layout.width * page.scale).toBeLessThanOrEqual(area.width + EPS);
            expect(page.layout.height * page.scale).toBeLessThanOrEqual(area.height + EPS);
            // cada nodo del layout entra completo dentro del área
            for (const n of page.layout.nodes) {
              expect((n.x + 208) * page.scale).toBeLessThanOrEqual(area.width + EPS);
              expect((n.y + 92) * page.scale).toBeLessThanOrEqual(area.height + EPS);
            }
          }
        }
      }
    }
  });

  it('uno grande se reparte por ramas: índice primero, todas las personas aparecen y el jefe se repite', () => {
    const root = big();
    const pages = planPages(root, 'hierarchy', 'carta');
    expect(pages[0]!.kind).toBe('index');
    const list = charts(pages);
    expect(list.length).toBeGreaterThan(1);
    // todas las personas del organigrama están en alguna página
    const seen = new Set(list.flatMap((p) => ids(p.tree)));
    for (const id of ids(root)) expect(seen.has(id)).toBe(true);
    // cada página incluye a su jefe (referencia) y dice de qué rama es
    for (const p of list) {
      expect(p.subtitle).toMatch(/^Rama de /);
      expect(p.tree.children.length).toBeGreaterThan(0);
    }
    // todas legibles en este caso
    expect(list.every((p) => p.legible && p.scale >= MIN_SCALE)).toBe(true);
    // las entradas del índice apuntan a las páginas correctas
    const index = pages[0] as Extract<(typeof pages)[number], { kind: 'index' }>;
    expect(index.entries.map((e) => e.page)).toEqual(list.map((_, i) => i + 2));
    expect(index.entries.map((e) => e.people)).toEqual(list.map((p) => countPeople(p.tree)));
  });

  it('A3 no usa más páginas que Carta', () => {
    const carta = charts(planPages(big(), 'hierarchy', 'carta')).length;
    const a3 = charts(planPages(big(), 'hierarchy', 'a3')).length;
    expect(a3).toBeLessThanOrEqual(carta);
  });

  it('un jefe con muchísimos directos no entra en bucle: se reparte y avisa si no llega a la escala mínima', () => {
    const wide = person('TEST-Jefe', 'IV', Array.from({ length: 80 }, (_, i) => person(`TEST-Directo ${i}`, 'I')));
    const pages = planPages(wide, 'hierarchy', 'carta');
    const list = charts(pages);
    expect(list.length).toBeGreaterThan(1);
    expect(list.every((p) => p.scale > 0)).toBe(true);
    expect(new Set(list.flatMap((p) => ids(p.tree))).size).toBe(81);
  });

  it('una cadena profunda baja de nivel cuando una rama sola no cabe', () => {
    const leaf = (n: number) => Array.from({ length: n }, (_, i) => person(`TEST-Hoja ${i}`, 'I'));
    const deep = person('TEST-Raíz', 'IV', [person('TEST-Medio', 'III', [person('TEST-Sub', 'III', leaf(12))])]);
    const pages = planPages(deep, 'hierarchy', 'carta');
    const list = charts(pages);
    // los jefes de arriba se repiten en cada página (la raíz abre todas las ramas) y nadie queda fuera
    expect(list.length).toBeGreaterThan(1);
    expect(list.every((p) => p.tree.id === deep.id)).toBe(true);
    expect(new Set(list.flatMap((p) => ids(p.tree))).size).toBe(ids(deep).length);
  });

  it('Por Niveles: cada página trae sus bandas con el nivel I arriba y «Sin Nivel» al final', () => {
    const pages = planPages(org([small(), person('TEST-Sin nivel', null)]), 'levels', 'carta', ['I', 'II', 'III', 'IV']);
    const first = charts(pages)[0]!;
    expect('bands' in first.layout).toBe(true);
    const labels = (first.layout as { bands: { label: string }[] }).bands.map((b) => b.label);
    expect(labels[0]).toBe('Nivel I');
    expect(labels.at(-1)).toBe('Sin Nivel');
  });

  it('fitScale respeta el área y el máximo', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 1000, height: 1000 })).toBe(MAX_SCALE);
    expect(fitScale({ width: 2000, height: 100 }, { width: 1000, height: 1000 })).toBe(0.5);
    expect(fitScale({ width: 0, height: 0 }, { width: 1000, height: 1000 })).toBe(MAX_SCALE);
  });

  it('Carta y A3 en horizontal', () => {
    expect(PAPERS.carta.width).toBeGreaterThan(PAPERS.carta.height);
    expect(PAPERS.a3.width).toBeGreaterThan(PAPERS.a3.height);
    expect(PAPERS.a3.width).toBeGreaterThan(PAPERS.carta.width);
  });
});

describe('Organigrama PDF · textos del encabezado', () => {
  it('filtros activos en texto, y «Sin filtros»', () => {
    expect(filtersText(EMPTY_SELECTION)).toBe('Sin filtros');
    expect(filtersText({ ...EMPTY_SELECTION, company: 'Lievant', division: 'E-Commerce' })).toBe('Empresa: Lievant · División: E-Commerce');
    expect(filtersText({ ...EMPTY_SELECTION, area: 'TI', level: 'III', location: 'León' })).toBe('Área: TI · Nivel: III · Ubicación: León');
    expect(filtersText({ ...EMPTY_SELECTION, division: NONE_VALUE, level: NONE_VALUE })).toBe('División: Sin División · Nivel: Sin Nivel');
  });
  it('fecha y hora en America/Mexico_City', () => {
    expect(generatedAtText('2026-10-28T19:45:00.000Z')).toBe('28/10/2026 13:45');
    expect(pdfFileName('2026-10-29T03:30:00.000Z')).toBe('Organigrama_2026-10-28.pdf');
  });
});

describe('Organigrama PDF · archivo generado', () => {
  const base = {
    preferredLevels: ['I', 'II', 'III', 'IV'],
    counts: { matched: 4, total: 12 },
    generatedAt: '2026-10-28T19:45:00.000Z',
    organization: 'Lievant',
    hiddenCount: () => 0,
  };
  /** Texto de las páginas: lee los `<hex> Tj` del contenido (la fuente estándar WinAnsi coincide con Latin-1 en acentos y ñ). */
  const text = async (bytes: Uint8Array): Promise<string> => {
    const doc = await PDFDocument.load(bytes);
    let out = '';
    for (const page of doc.getPages()) {
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
      for (const st of streams) {
        const raw = st instanceof PDFRawStream ? decodePDFRawStream(st).decode() : (st as unknown as { getContents(): Uint8Array }).getContents();
        const src = Buffer.from(raw).toString('latin1');
        for (const m of src.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += `${Buffer.from(m[1]!, 'hex').toString('latin1')}
`;
      }
    }
    return out;
  };

  it('PDF válido con texto seleccionable, acentos y ñ, encabezado y pie «Página X de Y»', async () => {
    const root = person('TEST-Ángela Peña Núñez', 'IV', [person('TEST-Muñoz', 'III', [], 'Gerente de Operaciones Técnicas', 'TEST-Tecnología')]);
    const { bytes, pages } = await buildOrgPdf({ ...base, root, view: 'hierarchy', paper: 'carta', filtersText: 'Empresa: Lievant · División: E-Commerce' });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
    expect(pages).toHaveLength(1);
    expect(bytes.length).toBeLessThan(60_000);
    const t = await text(bytes);
    expect(t).toContain('Organigrama');
    expect(t).toContain('Empresa: Lievant · División: E-Commerce');
    expect(t).toContain('Generado: 28/10/2026 13:45');
    expect(t).toContain('Vista: Jerarquía');
    expect(t).toContain('Mostrando 4 de 12 Colaboradores');
    expect(t).toContain('TEST-Ángela Peña Núñez');
    expect(t).toContain('Gerente de Operaciones Técnicas');
    expect(t).toContain('Nivel IV');
    expect(t).toContain('Página 1 de 1');
    expect(t).toContain('Lievant');
  });

  it('Por Niveles: las bandas llevan su etiqueta; uno grande lleva índice y numeración de páginas', async () => {
    const lv = await buildOrgPdf({ ...base, root: org([small(), person('TEST-Sin nivel', null)]), view: 'levels', paper: 'a3', filtersText: 'Sin filtros' });
    const t = await text(lv.bytes);
    for (const label of ['Nivel I', 'Nivel II', 'Nivel III', 'Nivel IV', 'Sin Nivel', 'Organización']) expect(t).toContain(label);
    expect(t).toContain('Vista: Por Niveles');

    const many = await buildOrgPdf({ ...base, root: big(), view: 'hierarchy', paper: 'carta', filtersText: 'Sin filtros' });
    expect(many.pages.length).toBeGreaterThan(2);
    const t2 = await text(many.bytes);
    expect(t2).toContain('Índice de Páginas');
    expect(t2).toContain(`Página 1 de ${many.pages.length}`);
    expect(t2).toContain(`Página ${many.pages.length} de ${many.pages.length}`);
    expect(many.bytes.length).toBeLessThan(250_000);
  });

  it('un carácter que la fuente no puede escribir no rompe la generación', async () => {
    const root = person('TEST-Zhang 张伟 ✓', 'II');
    const { bytes } = await buildOrgPdf({ ...base, root, view: 'hierarchy', paper: 'carta', filtersText: 'Sin filtros' });
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('un nodo contraído muestra cuántos descendientes oculta', async () => {
    const root = person('TEST-Jefe', 'III', [person('TEST-Contraído', 'II')]);
    const hidden = root.children[0]!.id;
    const { bytes } = await buildOrgPdf({ ...base, root, view: 'hierarchy', paper: 'carta', filtersText: 'Sin filtros', hiddenCount: (id) => (id === hidden ? 7 : 0) });
    expect(await text(bytes)).toContain('+7');
  });
});
