import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
import { buildLineKeysSelect, LINE_ROW_TYPE, lineRowPlan, toLineRow } from './inventory-line-rows';
import { InventoryService } from './inventory.service';

const reader = {
  roles: [{ name: 'DIRECTOR', permissions: [{ section: 'transformacion', module: 'sim-cards', action: 'read' }] }],
  userPermissions: [],
} as any;
const noSims = {
  roles: [{ name: 'DIRECTOR', permissions: [{ section: 'transformacion', module: 'inventario', action: 'read' }] }],
  userPermissions: [],
} as any;
const superAdmin = { roles: [{ name: 'SUPER_ADMIN' }], userPermissions: [] } as any;

const E1 = '11111111-1111-4111-8111-111111111111';
const E2 = '22222222-2222-4222-8222-222222222222';
const L1 = '33333333-3333-4333-8333-333333333333';

function equipment(id: string) {
  return {
    id,
    displayId: `TEC-${id.slice(0, 2)}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    warrantyExpiryDate: null,
    financialProviderId: null,
    invoiceNumber: null,
    invoiceDate: null,
    purchaseValue: null,
    assignedEmployee: null,
  };
}

function lineRaw(id = L1, over: Record<string, unknown> = {}) {
  return {
    id,
    sim_code: 'SIM-007',
    phone_number: '4775550101',
    status: 'activa',
    created_at: new Date('2026-02-01T00:00:00Z'),
    plan_name: 'Plan 5GB',
    provider_name: 'AT&T',
    employee_id: 'emp-1',
    employee_name: 'Ana Pérez',
    employee_email: 'ana@lievant.com',
    employee_area: 'Ventas',
    employee_location: 'León',
    ...over,
  };
}

interface Setup {
  equipment?: ReturnType<typeof equipment>[];
  keyRows?: { kind: 'equipment' | 'line'; id: string; ts: string }[];
  lines?: ReturnType<typeof lineRaw>[];
  simAgg?: unknown[];
  total?: number;
}

/** Servicio con un QueryBuilder y un repositorio falsos: interesa qué SQL se arma y cuántas consultas se hacen. */
function setup(opts: Setup = {}) {
  const wheres: string[] = [];
  const selects: unknown[][] = [];
  const equipment_ = opts.equipment ?? [];
  const qb: any = {
    leftJoinAndSelect: () => qb,
    where: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    andWhere: (sql: string) => {
      wheres.push(sql);
      return qb;
    },
    clone: () => qb,
    select: (...a: unknown[]) => {
      selects.push(a);
      return qb;
    },
    addSelect: (...a: unknown[]) => {
      selects.push(a);
      return qb;
    },
    getQueryAndParameters: () => ['SELECT "e"."id" AS "id" FROM inventory.equipment "e" WHERE "e"."deleted_at" IS NULL', []],
    getCount: async () => equipment_.length,
    limit: () => qb,
    getMany: async () => equipment_,
  };
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (/count\(\*\) AS total FROM \(/.test(sql)) return [{ total: String(opts.total ?? opts.keyRows?.length ?? 0) }];
    if (/SELECT u\.kind, u\.id, u\.ts/.test(sql)) return opts.keyRows ?? [];
    if (/ANY\(\$1::uuid\[\]\)/.test(sql) && /inventory\.sim_cards s/.test(sql)) return opts.lines ?? [];
    if (/GROUP BY equipment_id/.test(sql)) return opts.simAgg ?? [];
    return [];
  });
  const service = Object.create(InventoryService.prototype) as any;
  service.equipmentRepo = { createQueryBuilder: () => qb, query };
  service.deriveMaintenanceForEquipmentIds = jest.fn(async () => new Map());
  service.vendorNames = jest.fn(async () => new Map());
  return { service: service as InventoryService, wheres, selects, query };
}

const ts = (d: string) => new Date(d).toISOString();

describe('Inventario · plan de filas de línea', () => {
  it('sin filtros, o con "Con línea", las líneas entran; "Sin línea" las excluye', () => {
    expect(lineRowPlan({}).includeLines).toBe(true);
    expect(lineRowPlan({ simLine: 'con' }).includeLines).toBe(true);
    expect(lineRowPlan({ simLine: 'sin' }).includeLines).toBe(false);
  });

  it('el tipo "Línea Telefónica" las aísla; cualquier otro tipo las excluye', () => {
    expect(lineRowPlan({ equipmentType: LINE_ROW_TYPE })).toEqual({ includeLines: true, onlyLines: true });
    expect(lineRowPlan({ equipmentType: 'Laptop' }).includeLines).toBe(false);
  });

  it('Marca y Estatus de equipo no aplican a una línea y la dejan fuera; Área, Ubicación y persona sí aplican', () => {
    expect(lineRowPlan({ brand: 'Apple' }).includeLines).toBe(false);
    expect(lineRowPlan({ status: 'Asignado' }).includeLines).toBe(false);
    expect(lineRowPlan({ area: 'Ventas' }).includeLines).toBe(true);
    expect(lineRowPlan({ location: 'León' }).includeLines).toBe(true);
    expect(lineRowPlan({ assignedToEmployeeId: E1 }).includeLines).toBe(true);
  });
});

describe('Inventario · consulta de claves de líneas', () => {
  it('solo líneas vivas y sin equipo, y nunca toca el ICCID', () => {
    const { sql } = buildLineKeysSelect({}, 0);
    expect(sql).toContain('s.deleted_at IS NULL');
    expect(sql).toContain('s.equipment_id IS NULL');
    expect(sql).not.toMatch(/iccid/i);
  });

  it('la búsqueda cubre código, número, plan, compañía y empleado, con parámetros desplazados', () => {
    const { sql, params } = buildLineKeysSelect({ search: 'ana' }, 3);
    for (const col of ['s.sim_code', 's.phone_number', 'p.name', 'v.name', 'emp.full_name']) expect(sql).toContain(`${col} ILIKE $4`);
    expect(params).toEqual(['%ana%']);
  });

  it('área, ubicación y persona se aplican sobre los datos del empleado', () => {
    const { sql, params } = buildLineKeysSelect({ area: 'Ventas', location: 'León', assignedToEmployeeId: E1 }, 0);
    expect(sql).toContain('s.employee_id = $1');
    expect(sql).toContain('emp.area = $2');
    expect(sql).toContain('emp.location = $3');
    expect(params).toEqual([E1, 'Ventas', 'León']);
  });
});

describe('Inventario · filas de línea en la lista', () => {
  it('una línea sin equipo aparece como fila propia, mezclada en el orden de la unión', async () => {
    const { service } = setup({
      equipment: [equipment(E1)],
      keyRows: [
        { kind: 'line', id: L1, ts: ts('2026-02-01') },
        { kind: 'equipment', id: E1, ts: ts('2026-01-01') },
      ],
      lines: [lineRaw()],
      simAgg: [],
    });
    const page = (await service.findAll({}, reader)) as any;

    expect(page.data).toHaveLength(2);
    const line = page.data[0];
    expect(line).toMatchObject({
      rowKind: 'line',
      id: L1,
      displayId: 'SIM-007',
      legacyId: null,
      equipmentType: LINE_ROW_TYPE,
      brand: 'AT&T',
      model: 'Plan 5GB',
      assignedEmployeeName: 'Ana Pérez',
      area: 'Ventas',
      location: 'León',
      status: 'Activa',
      simCardCount: 1,
      simCardPhones: ['4775550101'],
    });
    expect(JSON.stringify(line)).not.toMatch(/iccid/i);
    // La fila de equipo conserva su forma: sin rowKind.
    expect(page.data[1].id).toBe(E1);
    expect('rowKind' in page.data[1]).toBe(false);
  });

  it('una línea con equipo no se duplica: solo se piden filas de líneas sin equipo', async () => {
    const { service, query } = setup({ keyRows: [{ kind: 'line', id: L1, ts: ts('2026-02-01') }], lines: [lineRaw()] });
    await service.findAll({}, reader);
    const keySql = query.mock.calls.map(([s]) => s).find((s) => /SELECT u\.kind/.test(s))!;
    expect(keySql).toContain('s.equipment_id IS NULL');
  });

  it('sin sim-cards.read no se mezcla nada: ni consulta de unión ni filas de línea', async () => {
    const { service, query } = setup({ equipment: [equipment(E1)] });
    const page = (await service.findAll({}, noSims)) as any;
    expect(query.mock.calls.some(([s]) => /UNION ALL|u\.kind/.test(s))).toBe(false);
    expect(page.data.map((d: any) => d.id)).toEqual([E1]);
    expect('simCardCount' in page.data[0]).toBe(false);
  });

  it('sin usuario resuelto tampoco', async () => {
    const { service, query } = setup({ equipment: [equipment(E1)] });
    await service.findAll({});
    expect(query.mock.calls.some(([s]) => /UNION ALL/.test(s))).toBe(false);
  });

  it('el total y la paginación salen de la unión e incluyen las líneas', async () => {
    const keyRows = [
      { kind: 'line' as const, id: L1, ts: ts('2026-03-01') },
      { kind: 'equipment' as const, id: E1, ts: ts('2026-02-01') },
      { kind: 'equipment' as const, id: E2, ts: ts('2026-01-01') },
    ];
    const { service, query } = setup({ equipment: [equipment(E1)], keyRows, lines: [lineRaw()], total: 57 });
    const page = (await service.findAll({ limit: 2 }, reader)) as any;

    expect(page.total).toBe(57);
    expect(page.data).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
    const [cursorDate, cursorId] = Buffer.from(page.nextCursor, 'base64url').toString().split('|');
    expect(cursorId).toBe(E1);
    expect(cursorDate).toBe(ts('2026-02-01'));
    const keySql = query.mock.calls.map(([s]) => s).find((s) => /SELECT u\.kind/.test(s))!;
    expect(keySql).toContain('ORDER BY u.ts DESC, u.id DESC LIMIT 3');
    expect(keySql).toContain('UNION ALL');
  });

  it('con cursor, la condición va sobre la unión y un cursor malformado se rechaza', async () => {
    const { service, query } = setup({ keyRows: [] });
    const cursor = Buffer.from(`${ts('2026-02-01')}|${E1}`).toString('base64url');
    await service.findAll({ cursor }, reader);
    const call = query.mock.calls.find(([s]) => /SELECT u\.kind/.test(s))!;
    expect(call[0]).toMatch(/WHERE \(u\.ts < \$\d+::timestamptz/);
    expect(call[1]).toEqual(expect.arrayContaining([ts('2026-02-01'), E1]));
    await expect(setup().service.findAll({ cursor: 'basura' }, reader)).rejects.toThrow(BadRequestException);
  });

  it('sin N+1: una consulta de conteo, una de claves, una de líneas y una agregada de líneas por equipo', async () => {
    const keyRows = [
      { kind: 'line' as const, id: L1, ts: ts('2026-03-01') },
      { kind: 'equipment' as const, id: E1, ts: ts('2026-02-01') },
      { kind: 'equipment' as const, id: E2, ts: ts('2026-01-01') },
    ];
    const { service, query } = setup({ equipment: [equipment(E1), equipment(E2)], keyRows, lines: [lineRaw()], simAgg: [{ equipment_id: E1, cnt: '2', phones: ['4771110000', '4772220000'] }] });
    const page = (await service.findAll({}, superAdmin)) as any;

    const sqls = query.mock.calls.map(([s]) => s as string);
    expect(sqls.filter((s) => /count\(\*\) AS total/.test(s))).toHaveLength(1);
    expect(sqls.filter((s) => /SELECT u\.kind/.test(s))).toHaveLength(1);
    expect(sqls.filter((s) => /ANY\(\$1::uuid\[\]\)/.test(s) && /sim_cards s/.test(s))).toHaveLength(1);
    expect(sqls.filter((s) => /GROUP BY equipment_id/.test(s))).toHaveLength(1);
    const e1 = page.data.find((d: any) => d.id === E1);
    expect(e1.simCardCount).toBe(2);
    expect(page.data.find((d: any) => d.id === E2).simCardCount).toBe(0);
  });

  it('Tipo "Línea Telefónica": solo líneas, sin consultar equipos', async () => {
    const { service, query } = setup({ keyRows: [{ kind: 'line', id: L1, ts: ts('2026-02-01') }], lines: [lineRaw()] });
    const page = (await service.findAll({ equipmentType: LINE_ROW_TYPE }, reader)) as any;
    const keySql = query.mock.calls.map(([s]) => s).find((s) => /SELECT u\.kind/.test(s))!;
    expect(keySql).not.toContain('UNION ALL');
    expect(page.data.map((d: any) => d.rowKind)).toEqual(['line']);
  });

  it('"Sin línea" y otros filtros que no aplican siguen por el camino de equipos de siempre', async () => {
    for (const q of [{ simLine: 'sin' as const }, { brand: 'Apple' }, { equipmentType: 'Laptop' }]) {
      const { service, query } = setup({ equipment: [equipment(E1)] });
      const page = (await service.findAll(q, reader)) as any;
      expect(query.mock.calls.some(([s]) => /UNION ALL|u\.kind/.test(s))).toBe(false);
      expect(page.data.some((d: any) => d.rowKind === 'line')).toBe(false);
    }
  });
});

describe('toLineRow', () => {
  it('sin empleado deja los campos de persona vacíos y traduce el estatus', () => {
    const r = toLineRow(lineRaw(L1, { employee_id: null, employee_name: null, employee_email: null, employee_area: null, employee_location: null, status: 'cancelada' }));
    expect(r.assignedEmployeeName).toBeNull();
    expect(r.area).toBeNull();
    expect(r.status).toBe('Cancelada');
  });
});

describe('QueryEquipmentDto · simLine', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'query', metatype: QueryEquipmentDto };

  it('acepta con y sin; rechaza otro valor; es opcional', async () => {
    await expect(pipe.transform({ simLine: 'con' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ simLine: 'sin' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({}, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ simLine: 'quizá' }, meta)).rejects.toThrow(BadRequestException);
  });
});
