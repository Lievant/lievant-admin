import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { OrgChartQueryDto } from './dto/org-chart-query.dto';
import { EmployeesController } from './employees.controller';
import { OrgChartService } from './org-chart.service';
import {
  NONE_VALUE,
  buildFilterOptions,
  buildOrgTree,
  compareLevels,
  filterOrgRows,
  normalizeValue,
  romanToNumber,
  rowMatches,
  type GroupedRow,
  type OrgNode,
  type OrgRow,
} from './org-chart.util';

function row(id: string, name: string, parent: string | null, over: Partial<OrgRow> = {}): OrgRow {
  return {
    id, displayId: `EMP-${id}`, fullName: name, position: `Cargo ${name}`, area: 'TI', level: 'II', companyName: 'Lievant',
    division: 'Tecnología', location: 'León', corporateEmail: `${id}@lievant.com`, phone: null, directReportToId: parent, ...over,
  };
}

/** Árbol de prueba:  dir (Dirección, I)
 *                      ├─ ger (TI, III)
 *                      │    ├─ ana (TI, II, León)
 *                      │    └─ beto (TI, I, Medellín)
 *                      └─ vta (Ventas, III)
 *                           └─ carla (Ventas, II)   ← subárbol sin coincidencias cuando se filtra TI */
const base = (): OrgRow[] => [
  row('dir', 'Dirección', null, { area: 'Dirección', level: 'IV', division: 'Dirección' }),
  row('ger', 'Gerente TI', 'dir', { level: 'III' }),
  row('ana', 'Ana', 'ger'),
  row('beto', 'Beto', 'ger', { level: 'I', location: 'Medellín' }),
  row('vta', 'Gerente Ventas', 'dir', { area: 'Ventas', level: 'III', division: 'Comercial' }),
  row('carla', 'Carla', 'vta', { area: 'Ventas', level: 'II', division: 'Comercial' }),
];
const ids = (r: OrgRow[]) => r.map((x) => x.id).sort();
const flat = (n: OrgNode): OrgNode[] => [n, ...n.children.flatMap(flat)];

describe('Organigrama · normalización y coincidencia', () => {
  it('compara sin distinguir mayúsculas ni espacios sobrantes', () => {
    expect(normalizeValue('  Tecnología   Aplicada ')).toBe('tecnología aplicada');
    expect(normalizeValue(null)).toBe('');
    const r = row('x', 'X', null, { area: '  ti  ' });
    expect(rowMatches(r, { area: 'TI' })).toBe(true);
    expect(rowMatches(r, { area: ' T I ' })).toBe(false);
  });
  it('"Sin X" coincide con vacío o solo espacios, no con valores', () => {
    expect(rowMatches(row('x', 'X', null, { division: null }), { division: NONE_VALUE })).toBe(true);
    expect(rowMatches(row('x', 'X', null, { division: '   ' }), { division: NONE_VALUE })).toBe(true);
    expect(rowMatches(row('x', 'X', null, { division: 'Tecnología' }), { division: NONE_VALUE })).toBe(false);
  });
});

describe('Organigrama · filtros', () => {
  it('sin filtros: todos, sin cambios', () => {
    const r = filterOrgRows(base(), {});
    expect(r.rows).toHaveLength(6);
    expect(r.matched).toBe(6);
    expect(r.rows.map((x) => x.directReportToId)).toEqual(base().map((x) => x.directReportToId));
  });

  it('cada filtro por separado', () => {
    expect(ids(filterOrgRows(base(), { company: 'lievant' }).rows)).toHaveLength(6);
    expect(filterOrgRows(base(), { company: 'Otra' }).matched).toBe(0);
    expect(filterOrgRows(base(), { division: 'Comercial' }).matched).toBe(2); // vta, carla
    expect(filterOrgRows(base(), { area: 'ti' }).matched).toBe(3); // ger, ana, beto
    expect(filterOrgRows(base(), { level: 'ii' }).matched).toBe(2); // ana, carla
    expect(filterOrgRows(base(), { location: 'Medellín' }).matched).toBe(1); // beto
  });

  it('combinados con AND', () => {
    const r = filterOrgRows(base(), { area: 'TI', level: 'II' });
    expect(r.matched).toBe(1);
    expect(filterOrgRows(base(), { division: 'Comercial', area: 'TI' }).matched).toBe(0);
    expect(filterOrgRows(base(), { area: 'TI', location: 'Medellín', level: 'I' }).matched).toBe(1);
  });

  const parents = (r: OrgRow[]) => Object.fromEntries(r.map((x) => [x.id, x.directReportToId]));

  it('un jefe que no coincide desaparece y sus subordinados suben al siguiente jefe que sí coincide', () => {
    const r = filterOrgRows(base(), { level: 'I' }); // solo Beto: ni Gerente ni Dirección coinciden
    expect(ids(r.rows)).toEqual(['beto']);
    const rows = [...base(), row('x', 'Equipo', 'ger', { level: 'I' })];
    expect(parents(filterOrgRows(rows, { level: 'I' }).rows)).toEqual({ beto: null, x: null });
    // Dirección, Ana y Carla coinciden por nivel; el Gerente (III) y la jefa de Ventas (III) no: suben a Dirección
    const f = filterOrgRows(
      base().map((x) => (x.id === 'dir' ? { ...x, level: 'II' } : x)),
      { level: 'II' },
    );
    expect(parents(f.rows)).toEqual({ dir: null, ana: 'dir', carla: 'dir' });
  });

  it('sin ningún jefe que coincida el empleado queda como raíz', () => {
    const r = filterOrgRows(base(), { location: 'Medellín' });
    expect(parents(r.rows)).toEqual({ beto: null });
    expect(buildOrgTree(r.rows).root).toMatchObject({ id: 'beto', children: [] });
  });

  it('un subordinado que no coincide desaparece aunque su jefe sí coincida', () => {
    const r = filterOrgRows(base(), { area: 'TI', level: 'III' }); // solo el Gerente TI
    expect(ids(r.rows)).toEqual(['ger']);
    expect(parents(r.rows)).toEqual({ ger: null });
  });

  it('el subárbol sin ninguna coincidencia desaparece', () => {
    const r = filterOrgRows(base(), { area: 'TI' });
    expect(ids(r.rows)).toEqual(['ana', 'beto', 'ger']);
    expect(parents(r.rows)).toEqual({ ger: null, ana: 'ger', beto: 'ger' });
  });

  it('varias raíces: cuelgan del nodo "Organización"', () => {
    const r = filterOrgRows(base(), { level: 'II' }); // Ana y Carla, sin jefes coincidentes
    const { root, stats } = buildOrgTree(r.rows);
    expect(root).toMatchObject({ synthetic: true, id: 'organization' });
    expect(stats.roots).toBe(2);
    expect(((root as unknown as { children: OrgNode[] }).children).map((c) => c.id).sort()).toEqual(['ana', 'carla']);
  });

  it('un solo resultado: el árbol parte directamente de él', () => {
    const { root } = buildOrgTree(filterOrgRows(base(), { area: 'TI', level: 'II' }).rows);
    expect(root).toMatchObject({ id: 'ana' });
    expect((root as OrgNode).children).toEqual([]);
  });

  it('un jefe de otra empresa se omite y el subordinado de la empresa filtrada sube', () => {
    const rows = [row('ext', 'Jefe Externo', null, { companyName: 'Filial' }), row('a', 'Sub A', 'ext'), row('b', 'Sub B', 'a')];
    expect(parents(filterOrgRows(rows, { company: 'Lievant' }).rows)).toEqual({ a: null, b: 'a' });
  });

  it('un subordinado con nivel mayor que el jefe sigue colgando del jefe si ambos coinciden', () => {
    const rows = [row('j', 'Jefe', null, { level: 'I' }), row('s', 'Sub', 'j', { level: 'IV' })];
    expect(parents(filterOrgRows(rows, { area: 'TI' }).rows)).toEqual({ j: null, s: 'j' });
    expect(parents(filterOrgRows(rows, { level: 'IV' }).rows)).toEqual({ s: null });
  });

  it('un filtro sin resultados: sin filas, sin árbol', () => {
    const r = filterOrgRows(base(), { area: 'Inexistente' });
    expect(r.rows).toEqual([]);
    expect(r.matched).toBe(0);
    expect(buildOrgTree(r.rows).root).toBeNull();
  });

  it('todos los filtros combinados', () => {
    const r = filterOrgRows(base(), { company: 'Lievant', division: 'Tecnología', area: 'TI', level: 'I', location: 'Medellín' });
    expect(ids(r.rows)).toEqual(['beto']);
    expect(filterOrgRows(base(), { company: 'Lievant', division: 'Tecnología', area: 'TI', level: 'I', location: 'León' }).rows).toEqual([]);
  });

  it('el filtro de país (ubicación) usa el mismo mecanismo: solo coincidencias', () => {
    expect(ids(filterOrgRows(base(), { location: 'Medellín' }).rows)).toEqual(['beto']);
  });

  it('un jefe ausente (inactivo): el empleado que coincide no se pierde y queda como huérfano', () => {
    const rows = [row('h', 'Huérfano', 'jefe-inactivo', { area: 'Rara' }), ...base()];
    const r = filterOrgRows(rows, { area: 'Rara' });
    expect(ids(r.rows)).toEqual(['h']);
    expect(buildOrgTree(r.rows).stats.orphans).toBe(1);
  });

  it('un huérfano cuyo jefe ausente queda más arriba sigue contando como huérfano', () => {
    const rows = [row('m', 'Medio', 'jefe-inactivo', { area: 'Otra' }), row('h', 'Hoja', 'm', { area: 'Rara' })];
    expect(buildOrgTree(filterOrgRows(rows, { area: 'Rara' }).rows).stats.orphans).toBe(1);
  });

  it('un ciclo en «Reporta a» no provoca recursión infinita ni al filtrar ni al armar el árbol', () => {
    const cyc = [row('a', 'A', 'b', { area: 'Ciclo' }), row('b', 'B', 'c', { area: 'Otra' }), row('c', 'C', 'a', { area: 'Otra' }), row('z', 'Z', null)];
    const r = filterOrgRows(cyc, { area: 'Ciclo' });
    expect(parents(r.rows)).toEqual({ a: null });
    const logs: string[] = [];
    const { stats } = buildOrgTree(filterOrgRows(cyc, { company: 'Lievant' }).rows, { onCycle: (m) => logs.push(m) });
    expect(stats.cycles).toBe(1);
    expect(logs).toHaveLength(1);
  });

  it('un ciclo con dos coincidencias se corta sin bucle y no pierde a nadie', () => {
    const cyc = [row('a', 'A', 'b', { area: 'Ciclo' }), row('b', 'B', 'c', { area: 'Ciclo' }), row('c', 'C', 'a', { area: 'Otra' })];
    const r = filterOrgRows(cyc, { area: 'Ciclo' });
    expect(ids(r.rows)).toEqual(['a', 'b']);
    const { root, stats } = buildOrgTree(r.rows);
    expect(stats.employees).toBe(2);
    expect(root).not.toBeNull();
  });

  it('un empleado que se apunta a sí mismo como jefe tampoco cicla', () => {
    const rows = [row('s', 'Solo', 's', { area: 'X' })];
    expect(parents(filterOrgRows(rows, { area: 'X' }).rows)).toEqual({ s: null });
  });

  it('una cadena muy profunda no desborda la pila al filtrar', () => {
    const rows: OrgRow[] = [row('n0', 'N0', null, { area: 'A' })];
    for (let i = 1; i < 5000; i++) rows.push(row(`n${i}`, `N${i}`, `n${i - 1}`, { area: i === 4999 ? 'Hoja' : 'A' }));
    const r = filterOrgRows(rows, { area: 'Hoja' });
    expect(r.rows).toHaveLength(1);
    expect(r.matched).toBe(1);
    expect(r.rows[0]!.directReportToId).toBeNull();
    const all = filterOrgRows(rows, { area: 'A' });
    expect(all.rows).toHaveLength(4999);
    expect(all.rows.find((x) => x.id === 'n4998')!.directReportToId).toBe('n4997');
  });

  it('una cadena larga de no coincidentes se resuelve hasta el primer jefe que coincide', () => {
    const rows: OrgRow[] = [row('n0', 'N0', null, { area: 'Jefe' })];
    for (let i = 1; i < 5000; i++) rows.push(row(`n${i}`, `N${i}`, `n${i - 1}`, { area: i === 4999 ? 'Jefe' : 'Medio' }));
    expect(parents(filterOrgRows(rows, { area: 'Jefe' }).rows)).toEqual({ n0: null, n4999: 'n0' });
  });

  it('el nodo de la respuesta ya no trae inContext', () => {
    const { root } = buildOrgTree(base());
    expect(flat(root as OrgNode).every((n) => !('inContext' in n))).toBe(true);
  });
});

describe('Organigrama · números romanos y orden de niveles', () => {
  it('romanToNumber de I a XX', () => {
    const expected = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
    expected.forEach((r, i) => expect(romanToNumber(r)).toBe(i + 1));
    expect(romanToNumber('XL')).toBe(40);
    expect(romanToNumber('MCMXCIV')).toBe(1994);
  });
  it('tolera minúsculas y espacios', () => {
    expect(romanToNumber('iii')).toBe(3);
    expect(romanToNumber('  Iv ')).toBe(4);
    expect(romanToNumber('X I')).toBe(11);
  });
  it('valores no romanos, mal formados o vacíos: null', () => {
    for (const bad of ['', '   ', null, undefined, 'Senior', 'A1', '3', 'IIII', 'VX', 'IC', 'IIV', 'N/A']) expect(romanToNumber(bad as never)).toBeNull();
  });

  it('el orden de los niveles es por valor romano, no alfabético', () => {
    // alfabético daría I, II, III, IV, IX, V, VI, X
    const sorted = ['X', 'V', 'IX', 'II', 'VI', 'I', 'IV', 'III'].sort((a, b) => compareLevels(a, b));
    expect(sorted).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'IX', 'X']);
  });
  it('los que no son romanos van al final en orden alfabético', () => {
    const sorted = ['Senior', 'II', 'Junior', 'I', 'A1'].sort((a, b) => compareLevels(a, b));
    expect(sorted).toEqual(['I', 'II', 'A1', 'Junior', 'Senior']);
  });
  it('si catalogs.org_levels define un orden, se usa ese; los romanos fuera del catálogo van después', () => {
    const catalog = new Map([['iii', 0], ['i', 1], ['ii', 2]]); // orden "raro" del catálogo
    const sorted = ['V', 'I', 'II', 'III', 'Otro'].sort((a, b) => compareLevels(a, b, catalog));
    expect(sorted).toEqual(['III', 'I', 'II', 'V', 'Otro']);
  });
});

describe('Organigrama · opciones de los filtros y cascada', () => {
  const g = (company: string | null, division: string | null, area: string | null, level: string | null, location: string | null, count: number): GroupedRow => ({ company, division, area, level, location, count });
  const grouped = [
    g('Lievant', 'Tecnología', 'TI', 'II', 'León', 5),
    g('Lievant', 'Tecnología', 'Datos', 'III', 'León', 3),
    g('Lievant', 'Comercial', 'Ventas', 'I', 'Medellín', 2),
    g('Filial', 'Operaciones', 'Soporte', 'II', 'Charlotte', 4),
    g('Filial', null, null, null, null, 1),
  ];
  const opts = buildFilterOptions(grouped);

  it('empresas, divisiones, áreas y ubicaciones con conteos de empleados activos; "Sin X" solo si existe', () => {
    expect(opts.total).toBe(15);
    expect(opts.companies).toEqual([{ value: 'Filial', label: 'Filial', count: 5 }, { value: 'Lievant', label: 'Lievant', count: 10 }]);
    const divisions = opts.divisions.map((d) => d.label);
    expect(divisions).toEqual(['Comercial', 'Operaciones', 'Tecnología', 'Sin División']);
    expect(opts.divisions.at(-1)).toEqual({ value: NONE_VALUE, label: 'Sin División', count: 1 });
    expect(opts.areas.at(-1)).toMatchObject({ value: NONE_VALUE, label: 'Sin Área' });
    expect(opts.locations.map((l) => l.label)).toContain('Sin Ubicación');
    // nadie sin empresa: no hay opción "Sin Empresa"
    expect(opts.companies.some((c) => c.value === NONE_VALUE)).toBe(false);
  });

  it('las combinaciones reales alimentan la cascada: divisiones de una empresa y áreas de una división', () => {
    const combos = opts.combinations;
    const divisionsOf = (company: string) => [...new Set(combos.filter((c) => c.company === company).map((c) => c.division))];
    const areasOf = (company: string | null, division: string) => [...new Set(combos.filter((c) => (company === null || c.company === company) && c.division === division).map((c) => c.area))];
    expect(divisionsOf('Lievant').sort()).toEqual(['Comercial', 'Tecnología']);
    expect(divisionsOf('Filial')).toEqual(expect.arrayContaining(['Operaciones', null]));
    expect(areasOf('Lievant', 'Tecnología').sort()).toEqual(['Datos', 'TI']);
    expect(areasOf(null, 'Comercial')).toEqual(['Ventas']);
    // una combinación inexistente no se ofrece
    expect(areasOf('Filial', 'Tecnología')).toEqual([]);
    expect(combos.reduce((a, c) => a + c.count, 0)).toBe(15);
  });

  it('agrupa sin distinguir mayúsculas ni espacios y muestra el valor más frecuente de cada grupo', () => {
    const o = buildFilterOptions([
      g('Lievant', 'tecnología', 'TI', null, null, 1),
      g('Lievant', 'Tecnología', 'TI', null, null, 6),
      g('Lievant', ' TECNOLOGÍA ', 'ti', null, null, 2),
    ]);
    expect(o.divisions).toEqual([{ value: 'Tecnología', label: 'Tecnología', count: 9 }]);
    expect(o.areas).toEqual([{ value: 'TI', label: 'TI', count: 9 }]);
    expect(o.combinations).toHaveLength(1);
    expect(o.combinations[0]).toMatchObject({ division: 'Tecnología', area: 'TI', count: 9 });
  });

  it('los niveles se ordenan por valor romano con los no romanos al final y "Sin Nivel" hasta el final de todo', () => {
    const o = buildFilterOptions([g('A', null, null, 'V', null, 1), g('A', null, null, 'I', null, 1), g('A', null, null, 'Sr', null, 1), g('A', null, null, null, null, 2), g('A', null, null, 'X', null, 1), g('A', null, null, 'II', null, 1), g('A', null, null, 'IX', null, 1)]);
    expect(o.levels.map((l) => l.label)).toEqual(['I', 'II', 'V', 'IX', 'X', 'Sr', 'Sin Nivel']);
  });

  it('con catalogs.org_levels, los niveles siguen el sort_order del catálogo', () => {
    const catalog = new Map([['i', 0], ['ii', 1], ['iii', 2], ['iv', 3]]);
    const o = buildFilterOptions([g('A', null, null, 'IV', null, 1), g('A', null, null, 'II', null, 1), g('A', null, null, 'III', null, 1), g('A', null, null, 'I', null, 1)], catalog);
    expect(o.levels.map((l) => l.label)).toEqual(['I', 'II', 'III', 'IV']);
  });
});

describe('Organigrama · servicio y rutas', () => {
  it('las opciones salen de UNA consulta agrupada sobre activos y no eliminados (más el orden del catálogo de niveles)', async () => {
    const calls: string[] = [];
    const query = jest.fn(async (sql: string) => {
      calls.push(sql);
      if (/catalogs\.org_levels/.test(sql)) return [{ code: 'I', sort_order: 0 }, { code: 'II', sort_order: 1 }];
      return [{ company: 'Lievant', division: null, area: 'TI', level: 'II', location: 'León', count: 4 }];
    });
    const service = new OrgChartService({ query } as never);
    const res = await service.getFilters();
    const employeesQueries = calls.filter((c) => /FROM employees\.employee_records/.test(c));
    expect(employeesQueries).toHaveLength(1);
    expect(employeesQueries[0]).toContain("e.status = 'active'");
    expect(employeesQueries[0]).toContain('e.deleted_at IS NULL');
    expect(employeesQueries[0]).toContain('GROUP BY');
    expect(employeesQueries[0]).not.toMatch(/salary|compensation|curp|rfc/i);
    expect(res.total).toBe(4);
  });

  it('si el catálogo de niveles falla, las opciones igual salen (orden por valor romano)', async () => {
    const query = jest.fn(async (sql: string) => {
      if (/catalogs\.org_levels/.test(sql)) throw new Error('no existe');
      return [{ company: 'A', division: null, area: null, level: 'II', location: null, count: 1 }];
    });
    const res = await new OrgChartService({ query } as never).getFilters();
    expect(res.levels.map((l) => l.label)).toEqual(['II']);
  });

  it('el árbol es una sola consulta con cualquier combinación de filtros, y el conteo es "X de Y"', async () => {
    const raw = (id: string, name: string, parent: string | null, area: string) => ({
      id, display_id: id, full_name: name, position: 'C', area, level: 'II', company_name: 'L', division: 'D', location: 'León',
      corporate_email: null, direct_report_to_id: parent, phone: null,
    });
    const query = jest.fn(async () => [raw('a', 'Ana', null, 'Dirección'), raw('b', 'Beto', 'a', 'TI'), raw('c', 'Carla', 'a', 'Ventas')]);
    const res = await new OrgChartService({ query } as never).getOrgChart({ area: 'ti', level: 'ii', company: 'l', division: 'd', location: 'león' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(res.counts).toEqual({ matched: 1, total: 3 }); // solo Beto es de TI; Ana (jefa) queda como contexto
  });

  const proto = EmployeesController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  it('organigrama y filtros: solo sesión (cualquier usuario autenticado) y antes de las rutas con :id', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.getOrgChart!)).toBeNull();
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.getOrgChartFilters!)).toBeNull();
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('getOrgChartFilters')).toBeLessThan(order.indexOf('findOne'));
    expect(order.indexOf('getOrgChart')).toBeLessThan(order.indexOf('findOne'));
  });

  it('los parámetros nuevos son opcionales y se validan; sigue rechazando los desconocidos', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const meta: ArgumentMetadata = { type: 'query', metatype: OrgChartQueryDto };
    await expect(pipe.transform({}, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ company: 'Lievant', division: 'TI', area: 'Datos', level: 'III', location: 'León' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ level: 'x'.repeat(51) }, meta)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ company: 'x'.repeat(151) }, meta)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ country: 'MX' }, meta)).rejects.toThrow(BadRequestException);
  });
});
