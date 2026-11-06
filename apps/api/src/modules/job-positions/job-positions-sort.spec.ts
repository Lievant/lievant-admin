import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PositionQueryDto } from './dto/job-position.dto';
import { JobPositionsService } from './job-positions.service';
import { POSITION_SORT_COLUMNS, buildPositionOrder } from './job-positions.util';

const DEFAULT_ORDER = 'length(p.code) ASC, p.code ASC';

describe('Matriz de Puestos · orden de la lista (SQL)', () => {
  it('sin sortBy es el orden de siempre (código numérico)', () => {
    expect(buildPositionOrder()).toBe(DEFAULT_ORDER);
    expect(buildPositionOrder('', 'desc')).toBe(DEFAULT_ORDER);
  });

  it.each(POSITION_SORT_COLUMNS.map((c) => [c]))('%s: ascendente y descendente con vacíos al final y desempate por código', (column) => {
    const asc = buildPositionOrder(column, 'asc');
    const desc = buildPositionOrder(column, 'desc');
    expect(asc).toMatch(/ ASC NULLS LAST, length\(p\.code\) ASC, p\.code ASC$/);
    expect(desc).toMatch(/ DESC NULLS LAST, length\(p\.code\) ASC, p\.code ASC$/);
    // el desempate siempre es ascendente: la paginación no repite ni salta filas en ningún sentido
    expect(desc.endsWith(DEFAULT_ORDER)).toBe(true);
  });

  it('sortDir ausente es ascendente', () => {
    expect(buildPositionOrder('title')).toContain(' ASC NULLS LAST');
  });

  it('código: por el número, no alfabético («JP-2» antes que «JP-10»)', () => {
    expect(buildPositionOrder('code')).toContain("NULLIF(regexp_replace(p.code, '\\D', '', 'g'), '')::bigint ASC");
  });

  it('texto (Puesto, División, Área): sin distinguir mayúsculas ni acentos, y vacío cuenta como NULL', () => {
    for (const [column, col] of [['title', 'p.title'], ['division', 'p.division'], ['area', 'p.area']] as const) {
      expect(buildPositionOrder(column)).toContain(`NULLIF(translate(lower(btrim(${col})), 'áéíóúüñ', 'aeiouun'), '') ASC NULLS LAST`);
    }
  });

  it('nivel: por el sort_order del catálogo org_levels (de I a IX), no alfabético; el que no está en el catálogo va al final', () => {
    const sql = buildPositionOrder('level', 'desc');
    expect(sql).toContain('SELECT l.sort_order FROM catalogs.org_levels l');
    expect(sql).toContain('upper(btrim(l.code)) = upper(btrim(p.level))');
    expect(sql).toContain('DESC NULLS LAST');
  });

  it('categoría, validación y estado: en el orden lógico de la pantalla', () => {
    expect(buildPositionOrder('seniority')).toContain("CASE p.seniority WHEN 'junior' THEN 1 WHEN 'semi_senior' THEN 2 WHEN 'senior' THEN 3 END");
    expect(buildPositionOrder('validationStatus')).toContain("WHEN 'pendiente' THEN 1 WHEN 'validado' THEN 2 WHEN 'validado_con_ajustes' THEN 3 WHEN 'rechazado' THEN 4");
    expect(buildPositionOrder('status')).toContain("WHEN 'activo' THEN 1 WHEN 'pendiente_aprobacion' THEN 2 WHEN 'inactivo' THEN 3");
  });

  it('plazas: numérico (el vacante, 0, es un valor; sin dato va al final)', () => {
    expect(buildPositionOrder('plazas', 'desc')).toMatch(/^p\.plazas DESC NULLS LAST/);
  });

  it('una columna fuera de la lista da 400 y nunca se interpola texto del usuario', () => {
    for (const bad of ['salary', 'p.code', 'code; DROP TABLE hr.job_positions', "title') --", 'TITLE', 'business_unit']) {
      expect(() => buildPositionOrder(bad, 'asc')).toThrow(BadRequestException);
    }
    // el sentido tampoco se interpola: cualquier valor que no sea «desc» es ASC
    expect(buildPositionOrder('title', 'asc; DROP TABLE x')).not.toMatch(/DROP/);
  });
});

describe('Matriz de Puestos · orden de la lista (DTO)', () => {
  const errs = async (plain: object) => (await validate(plainToInstance(PositionQueryDto, plain))).map((e) => e.property).sort();
  it('acepta cada columna permitida y los dos sentidos', async () => {
    for (const c of POSITION_SORT_COLUMNS) {
      expect(await errs({ sortBy: c, sortDir: 'asc' })).toEqual([]);
      expect(await errs({ sortBy: c, sortDir: 'desc' })).toEqual([]);
    }
    expect(await errs({})).toEqual([]);
  });
  it('rechaza una columna o un sentido inválidos (400 por la validación global)', async () => {
    expect(await errs({ sortBy: 'salary' })).toEqual(['sortBy']);
    expect(await errs({ sortBy: 'code', sortDir: 'sideways' })).toEqual(['sortDir']);
    expect(await errs({ sortDir: 'up' })).toEqual(['sortDir']);
  });
});

describe('Matriz de Puestos · orden de la lista (servicio)', () => {
  const build = () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
      calls.push({ sql: rawSql.replace(/\s+/g, ' ').trim(), params });
      return [];
    });
    return { service: new JobPositionsService({ query } as never, { logActivity: jest.fn() } as never), calls };
  };
  const listSql = (calls: { sql: string; params: unknown[] }[]) => calls.find((c) => /^SELECT p\.\*, COUNT\(\*\) OVER\(\)/.test(c.sql))!;

  it('sin orden pedido la consulta no cambia', async () => {
    const { service, calls } = build();
    await service.list(plainToInstance(PositionQueryDto, {}));
    expect(listSql(calls).sql).toContain(`ORDER BY ${DEFAULT_ORDER} LIMIT`);
  });

  it('el orden va en el SQL (sobre todos los registros), no en los parámetros, y se conservan filtros y búsqueda', async () => {
    const { service, calls } = build();
    await service.list(plainToInstance(PositionQueryDto, { sortBy: 'level', sortDir: 'desc', division: 'TI', area: 'Datos', validationStatus: 'validado', search: 'ana', page: '2', limit: '10' }));
    const q = listSql(calls);
    expect(q.sql).toContain('ORDER BY (SELECT l.sort_order FROM catalogs.org_levels l');
    expect(q.sql).toContain('p.area = $1');
    expect(q.sql).toContain('p.validation_status =');
    expect(q.sql).toContain('ILIKE');
    expect(q.params).not.toContain('level');
    expect(q.params).not.toContain('desc');
    // filtros + límite + desplazamiento (página 2 de 10)
    expect(q.params.slice(-2)).toEqual([10, 10]);
  });

  it('la página 2 usa exactamente el mismo orden que la 1 (desempate estable por código)', async () => {
    const { service, calls } = build();
    await service.list(plainToInstance(PositionQueryDto, { sortBy: 'title', sortDir: 'asc', page: '1', limit: '25' }));
    await service.list(plainToInstance(PositionQueryDto, { sortBy: 'title', sortDir: 'asc', page: '2', limit: '25' }));
    const [a, b] = calls.filter((c) => /^SELECT p\.\*, COUNT/.test(c.sql));
    const order = (s: string) => /ORDER BY (.*) LIMIT/.exec(s)![1];
    expect(order(a!.sql)).toBe(order(b!.sql));
    expect(order(a!.sql)).toMatch(/length\(p\.code\) ASC, p\.code ASC$/);
    expect(a!.params.slice(-1)).toEqual([0]);
    expect(b!.params.slice(-1)).toEqual([25]);
  });

  it('una columna inválida da 400 antes de consultar nada', async () => {
    const { service, calls } = build();
    await expect(service.list({ sortBy: 'password' } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(calls).toHaveLength(0);
  });
});
