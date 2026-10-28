import { NONE_VALUE, pageQuery, viewFromParams, EMPTY_SELECTION, FILTER_CUT_NOTE } from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-filters';
import { LABEL_GUTTER, bandEdgePath, layoutByLevels, levelKey, orderBandKeys } from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-bands';
import type { OrgPerson, OrgSynthetic, OrgTreeNode } from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-tree';

const CFG = { nodeWidth: 200, nodeHeight: 90, gapX: 20, gapY: 40 };

function p(id: string, level: string | null, children: OrgPerson[] = []): OrgPerson {
  return { id, displayId: id, fullName: id, position: 'Cargo', area: null, level, companyName: null, division: null, photoUrl: null, corporateEmail: null, children };
}
const org = (children: OrgPerson[]): OrgSynthetic => ({ id: 'organization', synthetic: true, fullName: 'Organización', children });
const at = (l: ReturnType<typeof layoutByLevels>, id: string) => l.nodes.find((n) => n.id === id)!;

describe('Organigrama (web) · orden de bandas', () => {
  it('el nivel I va arriba y "Sin Nivel" al final', () => {
    expect(orderBandKeys(['iii', NONE_VALUE, 'i', 'ii', 'iv'])).toEqual(['i', 'ii', 'iii', 'iv', NONE_VALUE]);
  });
  it('mismo orden que las opciones del filtro: catálogo, romanos fuera de catálogo, no romanos, sin nivel', () => {
    const preferred = ['i', 'ii', 'v', NONE_VALUE];
    expect(orderBandKeys(['zeta', 'vi', 'v', 'i', 'sr', 'ii', NONE_VALUE], preferred)).toEqual(['i', 'ii', 'v', 'vi', 'sr', 'zeta', NONE_VALUE]);
  });
  it('la clave del nivel se normaliza', () => {
    expect(levelKey(' II ')).toBe('ii');
    expect(levelKey('')).toBe(NONE_VALUE);
    expect(levelKey(null)).toBe(NONE_VALUE);
  });
});

describe('Organigrama (web) · vista por niveles', () => {
  const tree = p('dir', 'IV', [p('ger', 'III', [p('ana', 'II'), p('beto', 'I')]), p('sin', null)]);

  it('una banda por nivel con nodos, I arriba, "Sin Nivel" abajo', () => {
    const l = layoutByLevels(tree, CFG);
    expect(l.bands.map((b) => b.label)).toEqual(['Nivel I', 'Nivel II', 'Nivel III', 'Nivel IV', 'Sin Nivel']);
    expect(at(l, 'beto').y).toBeLessThan(at(l, 'ana').y);
    expect(at(l, 'ana').y).toBeLessThan(at(l, 'ger').y);
    expect(at(l, 'ger').y).toBeLessThan(at(l, 'dir').y);
    expect(at(l, 'dir').y).toBeLessThan(at(l, 'sin').y);
  });

  it('se omiten las bandas sin ningún nodo visible', () => {
    const l = layoutByLevels(p('a', 'III', [p('b', 'I')]), CFG);
    expect(l.bands.map((b) => b.key)).toEqual(['i', 'iii']);
    expect(layoutByLevels(p('solo', 'II'), CFG).bands.map((b) => b.label)).toEqual(['Nivel II']);
  });

  it('niveles escritos distinto caen en la misma banda', () => {
    const l = layoutByLevels(org([p('a', 'II'), p('b', ' ii '), p('c', 'Ii')]), CFG);
    expect(l.bands).toHaveLength(1);
    expect(new Set(l.nodes.filter((n) => n.id !== 'organization').map((n) => n.y)).size).toBe(1);
  });

  it('"Organización" va en una fila superior sin etiqueta', () => {
    const l = layoutByLevels(org([p('a', 'II'), p('b', 'I')]), CFG);
    expect(l.bands.map((b) => b.label)).toEqual(['Nivel I', 'Nivel II']);
    expect(at(l, 'organization').y).toBeLessThan(at(l, 'b').y);
    expect(l.bands[0]!.top).toBeGreaterThan(0);
  });

  it('sin choques: en cada banda los nodos quedan separados al menos el ancho más el espacio', () => {
    // padre con 5 hijos del mismo nivel y un nieto del mismo nivel que ellos: obliga a separar
    const root = p('r', 'I', [p('a', 'II', [p('a1', 'III')]), p('b', 'II'), p('c', 'II', [p('c1', 'II')]), p('d', 'II'), p('e', 'II')]);
    const l = layoutByLevels(root, CFG);
    const byRow = new Map<number, number[]>();
    for (const n of l.nodes) byRow.set(n.y, [...(byRow.get(n.y) ?? []), n.x]);
    for (const xs of byRow.values()) {
      const sorted = [...xs].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(CFG.nodeWidth + CFG.gapX);
    }
    expect(l.width).toBeGreaterThanOrEqual(Math.max(...l.nodes.map((n) => n.x)) + CFG.nodeWidth);
    expect(Math.min(...l.nodes.map((n) => n.x))).toBeGreaterThanOrEqual(LABEL_GUTTER);
  });

  it('los nodos caen dentro de su banda y el layout cubre todas las bandas', () => {
    const l = layoutByLevels(tree, CFG);
    for (const n of l.nodes) {
      const band = l.bands.find((b) => n.y >= b.top && n.y + CFG.nodeHeight <= b.top + b.height);
      expect(band).toBeDefined();
    }
    expect(l.height).toBe(l.bands.at(-1)!.top + l.bands.at(-1)!.height);
  });

  it('un jefe de nivel menor que su subordinado queda debajo (la relación se conserva en parentId)', () => {
    const l = layoutByLevels(p('j', 'I', [p('s', 'IV')]), CFG);
    expect(at(l, 's').parentId).toBe('j');
    expect(at(l, 's').y).toBeGreaterThan(at(l, 'j').y);
  });

  it('un jefe y su subordinado en la misma banda: el jefe queda a la izquierda', () => {
    const l = layoutByLevels(p('z-jefe', 'II', [p('a-sub', 'II')]), CFG);
    expect(at(l, 'z-jefe').x).toBeLessThan(at(l, 'a-sub').x);
  });

  it('un solo nivel filtrado deja una sola banda', () => {
    expect(layoutByLevels(org([p('a', 'II'), p('b', 'II')]), CFG).bands).toHaveLength(1);
  });

  it('el orden preferido (catálogo) manda sobre el orden romano', () => {
    const l = layoutByLevels(org([p('a', 'I'), p('b', 'II')]), CFG, ['ii', 'i']);
    expect(l.bands.map((b) => b.key)).toEqual(['ii', 'i']);
  });

  it('la raíz sintética no cuenta como banda', () => {
    const root: OrgTreeNode = org([p('a', null)]);
    expect(layoutByLevels(root, CFG).bands.map((b) => b.label)).toEqual(['Sin Nivel']);
  });

  it('curvas: hacia abajo, hacia arriba y en la misma banda', () => {
    const size = { width: 200, height: 90 };
    expect(bandEdgePath({ x: 0, y: 0 }, { x: 300, y: 200 }, size)).toMatch(/^M100,90 C100,145 400,145 400,200$/);
    expect(bandEdgePath({ x: 0, y: 200 }, { x: 300, y: 0 }, size)).toMatch(/^M100,200 C/);
    expect(bandEdgePath({ x: 0, y: 50 }, { x: 300, y: 50 }, size)).toMatch(/^M100,50 C100,30 /);
  });
});

describe('Organigrama (web) · vista en la URL', () => {
  it('lee y escribe vista=niveles junto a los filtros', () => {
    expect(viewFromParams({ vista: 'niveles' })).toBe('levels');
    expect(viewFromParams({ vista: 'otra' })).toBe('hierarchy');
    expect(viewFromParams(new URLSearchParams('area=TI&vista=niveles'))).toBe('levels');
    expect(pageQuery({ ...EMPTY_SELECTION, area: 'TI' }, 'levels')).toBe('area=TI&vista=niveles');
    expect(pageQuery(EMPTY_SELECTION, 'hierarchy')).toBe('');
  });
  it('el aviso del filtro usa el texto acordado', () => {
    expect(FILTER_CUT_NOTE).toBe('Los colaboradores cuyo jefe directo queda fuera del filtro se muestran bajo el siguiente jefe visible.');
  });
});
