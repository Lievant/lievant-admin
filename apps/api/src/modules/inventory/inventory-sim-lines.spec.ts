import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { QueryEquipmentDto } from './dto/query-equipment.dto';
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

function equipment(id: string) {
  return {
    id,
    displayId: `TEC-${id}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    warrantyExpiryDate: null,
    financialProviderId: null,
    invoiceNumber: null,
    invoiceDate: null,
    purchaseValue: null,
    assignedEmployee: null,
  };
}

/** Servicio con un QueryBuilder falso: solo interesa qué SQL se arma y qué consultas se hacen. */
function setup(rows: ReturnType<typeof equipment>[], simRows: unknown[] = []) {
  const wheres: string[] = [];
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
    getCount: async () => rows.length,
    limit: () => qb,
    getMany: async () => rows,
  };
  const query = jest.fn(async (_sql: string, _params?: unknown[]) => simRows);
  const service = Object.create(InventoryService.prototype) as any;
  service.equipmentRepo = { createQueryBuilder: () => qb, query };
  service.deriveMaintenanceForEquipmentIds = jest.fn(async () => new Map());
  service.vendorNames = jest.fn(async () => new Map());
  return { service: service as InventoryService, wheres, query };
}

describe('Inventario · líneas telefónicas por equipo', () => {
  it('con permiso: una sola consulta agregada para toda la página, sin N+1', async () => {
    const { service, query } = setup(
      [equipment('1'), equipment('2'), equipment('3')],
      [
        { equipment_id: '1', cnt: '2', phones: ['4771110000', '4772220000'] },
        { equipment_id: '3', cnt: '1', phones: ['4773330000'] },
      ],
    );
    const page = (await service.findAll({}, reader)) as any;

    const simQueries = query.mock.calls.filter(([sql]) => /inventory\.sim_cards/.test(sql));
    expect(simQueries).toHaveLength(1);
    expect(simQueries[0]![0]).toMatch(/GROUP BY equipment_id/);
    expect(simQueries[0]![0]).toMatch(/deleted_at IS NULL/);
    expect(simQueries[0]![1]).toEqual([['1', '2', '3']]);

    expect(page.data.map((d: any) => [d.id, d.simCardCount, d.simCardPhones])).toEqual([
      ['1', 2, ['4771110000', '4772220000']],
      ['2', 0, []],
      ['3', 1, ['4773330000']],
    ]);
  });

  it('nunca pide ni devuelve el ICCID', async () => {
    const { service, query } = setup([equipment('1')], [{ equipment_id: '1', cnt: '1', phones: ['4771110000'] }]);
    const page = (await service.findAll({}, superAdmin)) as any;
    expect(query.mock.calls.every(([sql]) => !/iccid/i.test(sql))).toBe(true);
    expect(JSON.stringify(page)).not.toMatch(/iccid/i);
  });

  it('sin sim-cards.read no se consulta ni se devuelve nada de líneas', async () => {
    const { service, query } = setup([equipment('1')]);
    const page = (await service.findAll({ simLine: 'con' }, noSims)) as any;
    expect(query).not.toHaveBeenCalled();
    expect('simCardCount' in page.data[0]).toBe(false);
    expect('simCardPhones' in page.data[0]).toBe(false);
  });

  it('sin usuario resuelto tampoco hay datos de líneas', async () => {
    const { service, query } = setup([equipment('1')]);
    const page = (await service.findAll({})) as any;
    expect(query).not.toHaveBeenCalled();
    expect('simCardCount' in page.data[0]).toBe(false);
  });

  it('el filtro con / sin línea se aplica con EXISTS solo para quien puede leer líneas', async () => {
    const con = setup([equipment('1')]);
    await con.service.findAll({ simLine: 'con' }, reader);
    expect(con.wheres.some((w) => /^EXISTS/.test(w.trim()) && /equipment_id = e\.id/.test(w) && /deleted_at IS NULL/.test(w))).toBe(true);

    const sin = setup([equipment('1')]);
    await sin.service.findAll({ simLine: 'sin' }, reader);
    expect(sin.wheres.some((w) => /^NOT EXISTS/.test(w.trim()))).toBe(true);

    const sinPermiso = setup([equipment('1')]);
    await sinPermiso.service.findAll({ simLine: 'con' }, noSims);
    expect(sinPermiso.wheres.some((w) => /EXISTS/.test(w))).toBe(false);
  });

  it('una página vacía no dispara la consulta agregada', async () => {
    const { service, query } = setup([]);
    await service.findAll({}, reader);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('QueryEquipmentDto · filtro simLine', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'query', metatype: QueryEquipmentDto };

  it('acepta con y sin; rechaza otro valor; es opcional', async () => {
    await expect(pipe.transform({ simLine: 'con' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ simLine: 'sin' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({}, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ simLine: 'quizá' }, meta)).rejects.toThrow(BadRequestException);
  });
});
