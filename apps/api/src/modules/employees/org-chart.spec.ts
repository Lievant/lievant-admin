import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { OrgChartQueryDto } from './dto/org-chart-query.dto';
import { EmployeesController } from './employees.controller';
import { OrgChartService } from './org-chart.service';
import { buildOrgTree, distinctLocations, ORGANIZATION_ID, photoUrlFor, type OrgNode, type OrgRow, type OrgRootNode } from './org-chart.util';

function row(id: string, name: string, parent: string | null = null, over: Partial<OrgRow> = {}): OrgRow {
  return {
    id,
    displayId: `EMP-${id}`,
    fullName: name,
    position: `Cargo ${name}`,
    area: 'Operaciones',
    corporateEmail: `${id}@lievant.com`,
    phone: '4770000000',
    directReportToId: parent,
    ...over,
  };
}

const names = (nodes: OrgNode[]) => nodes.map((n) => n.fullName);
const asRoot = (r: OrgNode | OrgRootNode | null) => r as OrgNode;

describe('buildOrgTree', () => {
  it('una sola raíz: el árbol parte de ella, con los hijos anidados y ordenados por nombre', () => {
    const { root, stats } = buildOrgTree([
      row('c', 'Carla', 'a'),
      row('a', 'Ana'),
      row('b', 'Beto', 'a'),
      row('d', 'Dani', 'b'),
    ]);
    expect(asRoot(root).fullName).toBe('Ana');
    expect(names(asRoot(root).children)).toEqual(['Beto', 'Carla']);
    expect(names(asRoot(root).children[0]!.children)).toEqual(['Dani']);
    expect(stats).toEqual({ employees: 4, roots: 1, orphans: 0, cycles: 0 });
  });

  it('varias raíces cuelgan del nodo neutro "Organización" (no es una persona)', () => {
    const { root, stats } = buildOrgTree([row('a', 'Ana'), row('b', 'Beto'), row('c', 'Carla', 'a')]);
    const org = root as OrgRootNode;
    expect(org.id).toBe(ORGANIZATION_ID);
    expect(org.synthetic).toBe(true);
    expect(org.fullName).toBe('Organización');
    expect(names(org.children)).toEqual(['Ana', 'Beto']);
    expect('photoUrl' in org).toBe(false);
    expect(stats.roots).toBe(2);
  });

  it('un huérfano (jefe inactivo, dado de baja o inexistente: no está entre las filas) no desaparece: es raíz', () => {
    const { root, stats } = buildOrgTree([
      row('a', 'Ana'),
      row('b', 'Beto', 'a'),
      row('h', 'Huérfano', 'jefe-inactivo'),
      row('i', 'Hijo del huérfano', 'h'),
    ]);
    expect(stats.orphans).toBe(1);
    expect(stats.roots).toBe(2);
    const children = (root as OrgRootNode).children;
    expect(names(children)).toEqual(['Ana', 'Huérfano']);
    expect(names(children[1]!.children)).toEqual(['Hijo del huérfano']);
  });

  it('un ciclo (A→B→A) se rompe sin recursión infinita, avisa, y nadie se pierde', () => {
    const warnings: string[] = [];
    const { root, stats } = buildOrgTree(
      [row('a', 'Ana', 'b'), row('b', 'Beto', 'a'), row('c', 'Carla', 'b'), row('x', 'Xavier')],
      { onCycle: (m) => warnings.push(m) },
    );
    expect(stats.cycles).toBe(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Ciclo en el organigrama');

    const count = (n: OrgNode | OrgRootNode): number => 1 + n.children.reduce((s, c) => s + count(c), 0);
    // 4 empleados + el nodo "Organización" (hay dos raíces: Xavier y el punto del corte)
    expect(count(root!)).toBe(5);
    const flat: string[] = [];
    const walk = (n: OrgNode | OrgRootNode) => {
      flat.push(n.fullName);
      n.children.forEach(walk);
    };
    walk(root!);
    expect(new Set(flat).size).toBe(flat.length);
    expect(flat.sort()).toEqual(['Ana', 'Beto', 'Carla', 'Organización', 'Xavier'].sort());
  });

  it('un ciclo completo sin ninguna otra raíz sigue produciendo árbol', () => {
    const { root, stats } = buildOrgTree([row('a', 'Ana', 'c'), row('b', 'Beto', 'a'), row('c', 'Carla', 'b')]);
    expect(stats.cycles).toBe(1);
    expect(stats.roots).toBe(1);
    expect(asRoot(root).fullName).toBe('Ana');
  });

  it('alguien que se reporta a sí mismo se trata como raíz huérfana', () => {
    const { root, stats } = buildOrgTree([row('a', 'Ana', 'a')]);
    expect(asRoot(root).fullName).toBe('Ana');
    expect(stats.orphans).toBe(1);
  });

  it('una cadena muy profunda no desborda la pila', () => {
    const rows: OrgRow[] = [row('n0', 'N0')];
    for (let i = 1; i < 5000; i++) rows.push(row(`n${i}`, `N${i}`, `n${i - 1}`));
    const { root, stats } = buildOrgTree(rows);
    expect(stats.roots).toBe(1);
    let depth = 0;
    let cursor: OrgNode = asRoot(root);
    while (cursor.children[0]) {
      cursor = cursor.children[0];
      depth++;
    }
    expect(depth).toBe(4999);
  });

  it('sin empleados no hay raíz', () => {
    expect(buildOrgTree([])).toEqual({ root: null, stats: { employees: 0, roots: 0, orphans: 0, cycles: 0 } });
  });

  it('la respuesta contiene solo los campos de la lista blanca', () => {
    const dirty = { ...row('a', 'Ana'), salary: 99999, curp: 'XXXX', rfc: 'YYYY', notes: 'interno', birthDate: '1990-01-01', address: 'Calle 1' } as OrgRow;
    const { root } = buildOrgTree([dirty, row('b', 'Beto', 'a')]);
    const allowed = ['children', 'area', 'corporateEmail', 'displayId', 'fullName', 'id', 'phone', 'photoUrl', 'position'].sort();
    const check = (n: OrgNode) => {
      expect(Object.keys(n).sort()).toEqual(allowed);
      n.children.forEach(check);
    };
    check(asRoot(root));
    expect(JSON.stringify(root)).not.toMatch(/salary|curp|rfc|notes|birthDate|address|99999/i);
  });

  it('el celular se puede apagar con una sola bandera: sin él, el campo no existe', () => {
    const { root } = buildOrgTree([row('a', 'Ana')], { showPhone: false });
    expect('phone' in asRoot(root)).toBe(false);
    expect(buildOrgTree([row('a', 'Ana')], { showPhone: true }).root).toMatchObject({ phone: '4770000000' });
  });
});

describe('photoUrlFor y ubicaciones', () => {
  it('reutiliza la ruta de avatares del sistema, con el correo codificado; sin correo, nada', () => {
    expect(photoUrlFor('ana@lievant.com')).toBe('/api/users/ana%40lievant.com/photo');
    expect(photoUrlFor(null)).toBeNull();
  });
  it('las ubicaciones del filtro salen sin vacíos ni repetidos, ordenadas', () => {
    expect(distinctLocations(['Medellín', 'León', null, '', 'León', '  '])).toEqual(['León', 'Medellín']);
  });
});

describe('OrgChartService', () => {
  function setup(rows: Record<string, unknown>[], allLocations: string[] = ['León', 'Medellín']) {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (/SELECT DISTINCT location/.test(sql)) return allLocations.map((location) => ({ location }));
      return rows;
    });
    const service = new OrgChartService({ query } as any);
    return { service, query };
  }
  const raw = (id: string, name: string, parent: string | null, location = 'León') => ({
    id,
    display_id: `EMP-${id}`,
    full_name: name,
    position: 'Cargo',
    area: 'Área',
    location,
    corporate_email: `${id}@lievant.com`,
    direct_report_to_id: parent,
    phone: '4771112222',
  });

  it('una sola consulta de empleados, solo activos y sin bajas lógicas, y el árbol en memoria', async () => {
    const { service, query } = setup([raw('a', 'Ana', null), raw('b', 'Beto', 'a')]);
    const res = await service.getOrgChart();
    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0]![0];
    expect(sql).toContain("e.status = 'active'");
    expect(sql).toContain('e.deleted_at IS NULL');
    expect(sql).not.toMatch(/salary|compensation|curp|rfc/i);
    expect((res.root as OrgNode).fullName).toBe('Ana');
    expect(res.stats.employees).toBe(2);
    expect(res.locations).toEqual(['León']);
  });

  it('el filtro por ubicación va parametrizado y las opciones del filtro siguen saliendo de todos los activos', async () => {
    const { service, query } = setup([raw('m', 'Mario', null, 'Medellín')]);
    const res = await service.getOrgChart('Medellín');
    const call = query.mock.calls.find(([sql]) => /FROM employees\.employee_records e/.test(sql))!;
    expect(call[0]).toContain('e.location = $1');
    expect(call[1]).toEqual(['Medellín']);
    expect(res.locations).toEqual(['León', 'Medellín']);
  });

  it('un jefe de otra ubicación no está en la vista filtrada: el subordinado queda como raíz y no se pierde', async () => {
    const { service } = setup([raw('b', 'Beto', 'jefe-en-leon', 'Medellín')]);
    const res = await service.getOrgChart('Medellín');
    expect((res.root as OrgNode).fullName).toBe('Beto');
    expect(res.stats.orphans).toBe(1);
  });
});

describe('Endpoint GET /employees/org-chart', () => {
  const proto = EmployeesController.prototype as any;

  it('es accesible a cualquier usuario autenticado: sobrescribe el permiso de la clase con null', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.getOrgChart)).toBeNull();
    expect(Reflect.getMetadata(PERMISSION_KEY, EmployeesController)).toEqual({ section: 'rrhh', module: 'empleados', action: 'read' });
  });

  it('se declara antes de :id para que no se confunda con un identificador', () => {
    const order = Object.getOwnPropertyNames(proto);
    const idRoute = Object.getOwnPropertyNames(proto).find((n) => /^findOne$|^findById$|^getEmployee$/.test(n));
    expect(order.indexOf('getOrgChart')).toBeGreaterThanOrEqual(0);
    if (idRoute) expect(order.indexOf('getOrgChart')).toBeLessThan(order.indexOf(idRoute));
  });

  it('el parámetro location es opcional y se valida', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const meta: ArgumentMetadata = { type: 'query', metatype: OrgChartQueryDto };
    await expect(pipe.transform({}, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ location: 'León' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ location: 'x'.repeat(101) }, meta)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ country: 'MX' }, meta)).rejects.toThrow(BadRequestException);
  });
});
