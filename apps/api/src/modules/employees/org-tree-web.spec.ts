import {
  allCollapsed,
  ancestorsOf,
  centerOn,
  clampScale,
  defaultCollapsed,
  descendantCount,
  findNode,
  fitTransform,
  flatten,
  isSynthetic,
  layoutTree,
  MAX_SCALE,
  MIN_SCALE,
  normalize,
  searchNodes,
  visibleTree,
  type OrgPerson,
  type OrgSynthetic,
  type OrgTreeNode,
} from '../../../../web/src/app/(dashboard)/rrhh/organigrama/org-tree';

function p(id: string, name: string, children: OrgPerson[] = []): OrgPerson {
  return { id, displayId: id, fullName: name, position: 'Cargo', area: null, photoUrl: null, corporateEmail: null, children };
}

// Ana
// ├─ Beto ── Dani ── Eva
// ├─ Carla
// └─ Álvaro
const eva = p('eva', 'Eva');
const dani = p('dani', 'Dani', [eva]);
const beto = p('beto', 'Beto', [dani]);
const carla = p('carla', 'Carla');
const alvaro = p('alvaro', 'Álvaro');
const ana = p('ana', 'Ana', [beto, carla, alvaro]);

const CFG = { nodeWidth: 100, nodeHeight: 40, gapX: 10, gapY: 20 };

describe('recorridos', () => {
  it('flatten devuelve todos los nodos de arriba abajo', () => {
    expect(flatten(ana).map((n) => n.id)).toEqual(['ana', 'beto', 'dani', 'eva', 'carla', 'alvaro']);
    expect(flatten(null)).toEqual([]);
  });
  it('findNode, ancestorsOf y descendantCount', () => {
    expect(findNode(ana, 'dani')?.fullName).toBe('Dani');
    expect(findNode(ana, 'nadie')).toBeNull();
    expect(ancestorsOf(ana, 'eva')).toEqual(['ana', 'beto', 'dani']);
    expect(ancestorsOf(ana, 'ana')).toEqual([]);
    expect(descendantCount(ana)).toBe(5);
    expect(descendantCount(carla)).toBe(0);
  });
});

describe('contraer y expandir', () => {
  it('la vista inicial queda abierta hasta el segundo nivel', () => {
    // profundidad 0 = Ana, 1 = Beto/Carla/Álvaro, 2 = Dani (con hijos → contraído), 3 = Eva
    expect([...defaultCollapsed(ana)]).toEqual(['dani']);
    expect(defaultCollapsed(null).size).toBe(0);
  });
  it('"Contraer todo" deja visible solo la raíz y sus hijos directos', () => {
    const collapsed = allCollapsed(ana);
    expect(collapsed.has('ana')).toBe(false);
    expect([...collapsed].sort()).toEqual(['beto', 'dani']);
    const v = visibleTree(ana, collapsed);
    expect(flatten(v).map((n) => n.id)).toEqual(['ana', 'beto', 'carla', 'alvaro']);
  });
  it('visibleTree no muta el árbol original', () => {
    visibleTree(ana, new Set(['beto']));
    expect(beto.children).toHaveLength(1);
    expect(flatten(visibleTree(ana, new Set(['beto']))).map((n) => n.id)).not.toContain('dani');
  });
});

describe('búsqueda', () => {
  it('ignora acentos y mayúsculas y pide al menos 2 caracteres', () => {
    expect(normalize('  ÁLVARO ')).toBe('alvaro');
    expect(searchNodes(ana, 'alvaro').map((n) => n.id)).toEqual(['alvaro']);
    expect(searchNodes(ana, 'ÁLV').map((n) => n.id)).toEqual(['alvaro']);
    expect(searchNodes(ana, 'a')).toEqual([]);
    expect(searchNodes(ana, 'zzz')).toEqual([]);
  });
  it('el nodo neutro "Organización" no aparece en los resultados', () => {
    const org: OrgSynthetic = { id: 'organization', synthetic: true, fullName: 'Organización', children: [ana] };
    expect(isSynthetic(org)).toBe(true);
    expect(searchNodes(org, 'organizacion')).toEqual([]);
    expect(searchNodes(org, 'ana').map((n) => n.id)).toEqual(['ana']);
  });
  it('respeta el límite de resultados', () => {
    const many = p('r', 'Raíz', Array.from({ length: 20 }, (_, i) => p(`x${i}`, `Persona ${i}`)));
    expect(searchNodes(many, 'persona', 5)).toHaveLength(5);
  });
});

describe('layoutTree', () => {
  const layout = layoutTree(ana, CFG);
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));

  it('cada nivel va en su propia fila', () => {
    expect(pos.get('ana')!.y).toBe(0);
    expect(pos.get('beto')!.y).toBe(60);
    expect(pos.get('dani')!.y).toBe(120);
    expect(pos.get('eva')!.y).toBe(180);
    expect(layout.height).toBe(4 * 40 + 3 * 20);
  });

  it('el padre queda centrado sobre sus hijos', () => {
    const centerX = (id: string) => pos.get(id)!.x + CFG.nodeWidth / 2;
    const kids = ['beto', 'carla', 'alvaro'].map(centerX);
    expect(centerX('ana')).toBeCloseTo((Math.min(...kids) + Math.max(...kids)) / 2);
  });

  it('ningún nodo se encima con otro de su misma fila', () => {
    const byRow = new Map<number, { x: number }[]>();
    for (const n of layout.nodes) byRow.set(n.y, [...(byRow.get(n.y) ?? []), n]);
    for (const row of byRow.values()) {
      const xs = row.map((n) => n.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(CFG.nodeWidth + CFG.gapX);
    }
  });

  it('todos los nodos caben dentro del ancho calculado', () => {
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + CFG.nodeWidth).toBeLessThanOrEqual(layout.width + 1e-9);
    }
    expect(layout.nodes).toHaveLength(6);
  });

  it('registra el padre de cada nodo; la raíz no tiene', () => {
    expect(pos.get('ana')!.parentId).toBeNull();
    expect(pos.get('eva')!.parentId).toBe('dani');
  });

  it('un árbol de un solo nodo mide lo que mide el nodo', () => {
    const one = layoutTree(p('solo', 'Solo'), CFG);
    expect(one.width).toBe(100);
    expect(one.height).toBe(40);
  });

  it('~130 nodos se acomodan sin encimarse', () => {
    const managers = Array.from({ length: 12 }, (_, i) => p(`m${i}`, `Jefe ${i}`, Array.from({ length: 9 }, (_, j) => p(`m${i}e${j}`, `Emp ${i}-${j}`))));
    const big = layoutTree(p('ceo', 'CEO', managers), CFG);
    expect(big.nodes).toHaveLength(1 + 12 + 108);
    const leaves = big.nodes.filter((n) => n.depth === 2).map((n) => n.x).sort((a, b) => a - b);
    for (let i = 1; i < leaves.length; i++) expect(leaves[i]! - leaves[i - 1]!).toBeGreaterThanOrEqual(CFG.nodeWidth + CFG.gapX);
  });
});

describe('zoom y navegación', () => {
  it('fitTransform ajusta el árbol al viewport sin pasar de escala 1 y lo centra horizontalmente', () => {
    const t = fitTransform({ width: 4000, height: 800 }, { width: 1000, height: 600 });
    expect(t.k).toBeLessThan(0.25);
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(fitTransform({ width: 100, height: 100 }, { width: 1000, height: 600 }).k).toBe(1);
    expect(fitTransform({ width: 0, height: 0 }, { width: 1000, height: 600 })).toEqual({ x: 0, y: 0, k: 1 });
  });
  it('centerOn lleva el centro del nodo al centro del viewport', () => {
    const t = centerOn({ x: 300, y: 100 }, CFG, { width: 800, height: 400 }, 1);
    expect(t.x + (300 + 50) * t.k).toBeCloseTo(400);
    expect(t.y + (100 + 20) * t.k).toBeCloseTo(200);
  });
  it('la escala se mantiene entre el mínimo y el máximo', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(99)).toBe(MAX_SCALE);
    expect(clampScale(1)).toBe(1);
  });
});

describe('tipos', () => {
  it('un árbol con el nodo neutro mantiene el contrato de nodo', () => {
    const org: OrgTreeNode = { id: 'organization', synthetic: true, fullName: 'Organización', children: [ana, carla] };
    expect(flatten(org)[0]!.id).toBe('organization');
  });
});
