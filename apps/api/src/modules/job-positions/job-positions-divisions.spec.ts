import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreatePositionDto } from './dto/job-position.dto';
import { JobPositionsService } from './job-positions.service';
import { buildPositionWhere, type PositionRow } from './job-positions.util';
import { canonicalDivision, loadCatalogDivisions, uniqueDivisionNames } from './job-positions-divisions';

const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };
const FULL = { roleSummary: 'TEST-Rol', positionObjective: 'TEST-Objetivo', validationPoints: 'TEST-Puntos', description: 'TEST-Descripción' };

describe('Divisiones · lista cerrada del catálogo', () => {
  it('sin repetidos aunque el nombre exista para varias empresas (sin distinguir mayúsculas, acentos ni espacios), ordenadas por nombre', () => {
    expect(uniqueDivisionNames(['TI', 'Comercial', 'ti ', 'COMERCIAL', 'Dirección', 'direccion', null, '  '])).toEqual(['Comercial', 'Dirección', 'TI']);
  });
  it('nombre canónico del catálogo para otra escritura; null si no existe', () => {
    const catalog = ['E-Commerce', 'Dirección', 'TI'];
    expect(canonicalDivision(catalog, 'e-commerce')).toBe('E-Commerce');
    expect(canonicalDivision(catalog, ' E-COMMERCE ')).toBe('E-Commerce');
    expect(canonicalDivision(catalog, 'DIRECCION')).toBe('Dirección');
    expect(canonicalDivision(catalog, 'Marketing')).toBeNull();
    expect(canonicalDivision(catalog, '')).toBeNull();
    expect(canonicalDivision(catalog, null)).toBeNull();
  });
  it('carga solo las activas del catálogo (consulta ordenada por nombre) y las deduplica', async () => {
    const calls: string[] = [];
    const m = { query: async (sql: string) => (calls.push(sql), [{ name: 'TI' }, { name: 'TI' }, { name: 'Comercial' }]) };
    expect(await loadCatalogDivisions(m)).toEqual(['Comercial', 'TI']);
    expect(calls[0]).toContain('catalogs.divisions');
    expect(calls[0]).toContain('is_active IS NOT FALSE');
    expect(calls[0]).toContain('ORDER BY name');
  });
});

function build(opts: { current?: Partial<PositionRow>; catalog?: string[]; used?: string[] } = {}) {
  const catalog = opts.catalog ?? ['E-Commerce', 'Finanzas', 'E-Commerce'];
  const current = {
    id: 'p1', code: 'JP-001', title: 'TEST-Puesto', area: 'TI', business_unit: null, level: null, description: 'TEST-Descripción', description_approved: false,
    description_approved_by: null, description_approved_at: null, status: 'pendiente_aprobacion', division: 'División Antigua', level_original: null, seniority: null,
    meot_hierarchy: null, reports_to_text: null, reports_to_employee_id: null, plazas: 1, role_summary: 'TEST-Rol', position_objective: 'TEST-Objetivo',
    validation_points: 'TEST-Puntos', head_comments: null, validation_status: 'pendiente', validated_by: null, validated_at: null,
    created_at: new Date(), updated_at: new Date(), ...opts.current,
  } as PositionRow;
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    if (/^SELECT name FROM catalogs\.divisions/.test(sql)) return catalog.map((name) => ({ name }));
    if (/FROM catalogs\.org_levels/.test(sql)) return [{ code: 'I', name: 'Nivel I' }];
    if (/FROM catalogs\.areas/.test(sql)) return [{ name: 'TI', division_name: 'E-Commerce' }, { name: 'TI', division_name: 'Finanzas' }, { name: 'Vieja', division_name: null }];
    if (/SELECT DISTINCT division AS v/.test(sql)) return (opts.used ?? ['División Antigua', 'E-Commerce']).map((v) => ({ v }));
    if (/SELECT DISTINCT/.test(sql)) return [];
    if (/SELECT code FROM hr\.job_positions/.test(sql)) return [];
    if (/INSERT INTO hr\.job_positions/.test(sql)) return [{ id: 'p1' }];
    if (/FOR UPDATE/.test(sql) || /^SELECT p\.\*/.test(sql)) return [current];
    return [];
  });
  const dataSource = { query, transaction: async (cb: (m: unknown) => Promise<unknown>) => cb({ query }) };
  return { service: new JobPositionsService(dataSource as never, { logActivity: jest.fn() } as never), calls };
}
const up = (calls: { sql: string; params: unknown[] }[]) => calls.filter((c) => /^UPDATE hr\.job_positions SET title/.test(c.sql));

describe('Matriz de Puestos · la división es una lista cerrada (400 y nombre canónico)', () => {
  it('crear con una división que no existe: 400 con la lista de las válidas (sin repetidos)', async () => {
    const { service } = build();
    const err = await service.create(plainToInstance(CreatePositionDto, { ...FULL, title: 'A', area: 'TI', division: 'Marketing' }), ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toBe('La división «Marketing» no está en el catálogo de divisiones. Elige una de la lista: E-Commerce, Finanzas');
  });

  it('crear guarda el nombre canónico del catálogo («e-commerce» → «E-Commerce»)', async () => {
    const { service, calls } = build();
    await service.create(plainToInstance(CreatePositionDto, { ...FULL, title: 'A', area: 'TI', division: ' e-COMMERCE ' }), ACTOR);
    const insert = calls.find((c) => /^INSERT INTO hr\.job_positions/.test(c.sql))!;
    expect(insert.params[8]).toBe('E-Commerce');
  });

  it('sin división sigue siendo válido (campo opcional)', async () => {
    const { service, calls } = build({ current: { division: null } });
    await service.create(plainToInstance(CreatePositionDto, { ...FULL, title: 'A', area: 'Vieja' }), ACTOR);
    expect(calls.find((c) => /^INSERT INTO hr\.job_positions/.test(c.sql))!.params[8]).toBeNull();
  });

  it('editar: cambiar a una división inexistente da 400; a una del catálogo, la guarda canónica', async () => {
    const { service, calls } = build({ current: { division: 'E-Commerce' } });
    await expect(service.update('p1', { division: 'Marketing' }, ACTOR)).rejects.toThrow(/no está en el catálogo de divisiones/);
    await service.update('p1', { division: 'FINANZAS' }, ACTOR);
    expect(up(calls)[0]!.params[10]).toBe('Finanzas');
  });

  it('un puesto antiguo con una división fuera de catálogo se edita en lo demás sin tocarla, y reenviar el mismo valor no se rechaza', async () => {
    const { service, calls } = build({ current: { division: 'División Antigua', area: 'Vieja' } });
    await service.update('p1', { title: 'TEST-Nuevo título' }, ACTOR);
    expect(up(calls)[0]!.params[10]).toBe('División Antigua');
    await service.update('p1', { title: 'TEST-Otro título', division: 'División Antigua', area: 'Vieja' }, ACTOR);
    expect(up(calls)[1]!.params[10]).toBe('División Antigua');
    // pero pasar a otro valor fuera del catálogo sí se rechaza
    await expect(service.update('p1', { division: 'Otra Antigua' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('al cambiar la división el área se revalida contra la división canónica', async () => {
    const { service } = build({ current: { division: 'E-Commerce', area: 'TI' } });
    await expect(service.update('p1', { division: 'Finanzas', area: 'Vieja' }, ACTOR)).rejects.toThrow(/no está en el catálogo de la división «Finanzas»/);
    await expect(service.update('p1', { division: 'finanzas', area: 'TI' }, ACTOR)).resolves.toBeDefined();
  });

  it('las opciones traen el catálogo sin repetidos para el formulario y, para el filtro, además las divisiones antiguas que ya tiene algún puesto', async () => {
    const { service } = build();
    const o = await service.getOptions();
    expect(o.divisions).toEqual(['E-Commerce', 'Finanzas']);
    expect(o.filterDivisions).toEqual(['División Antigua', 'E-Commerce', 'Finanzas']);
  });

  it('el filtro de la lista por una división antigua usa el valor tal cual (parámetro)', () => {
    const { where, params } = buildPositionWhere({ division: 'División Antigua' });
    expect(where).toContain("translate(lower(btrim(p.division)), 'áéíóúüñ', 'aeiouun') = translate(lower(btrim($1)), 'áéíóúüñ', 'aeiouun')");
    expect(params).toEqual(['División Antigua']);
  });
});
