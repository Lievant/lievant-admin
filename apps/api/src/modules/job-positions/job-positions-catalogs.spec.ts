import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreatePositionDto, UpdatePositionDto } from './dto/job-position.dto';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsService } from './job-positions.service';
import {
  arabicToRoman,
  areaKey,
  canonicalLevel,
  findAreaExact,
  findAreaNear,
  nearDuplicateAreas,
  parseSeniority,
  resolveLevel,
  seniorityFromText,
} from './job-positions-catalog.util';

const LEVELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const REQ = { roleSummary: 'TEST-Rol', positionObjective: 'TEST-Objetivo', validationPoints: 'TEST-Puntos', description: 'TEST-Descripción' };
const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };

describe('Listas cerradas · nivel', () => {
  it('«iv», « IV » y «4» son IV', () => {
    for (const v of ['iv', ' IV ', '4', 'Iv', 'IV']) expect(resolveLevel(v, LEVELS)).toEqual({ kind: 'ok', code: 'IV' });
    expect(arabicToRoman(8)).toBe('VIII');
    expect(arabicToRoman(15)).toBe('XV');
    expect(arabicToRoman(19)).toBe('XIX');
    expect(arabicToRoman(0)).toBe('');
  });
  it('vacío, ambiguo e inválido se distinguen', () => {
    expect(resolveLevel('', LEVELS)).toEqual({ kind: 'empty' });
    expect(resolveLevel(null, LEVELS)).toEqual({ kind: 'empty' });
    for (const v of ['Sin nivel', 'Por definir', 'V / VI', 'VII / VIII', 'Sin nivel (MEOT: III)']) expect(resolveLevel(v, LEVELS)).toEqual({ kind: 'ambiguous' });
    for (const v of ['XVI', '16', 'XX', 'Gerencia', 'Senior']) expect(resolveLevel(v, LEVELS)).toEqual({ kind: 'invalid' });
  });
  it('código canónico para un valor ya escrito', () => {
    expect(canonicalLevel(' ii ', LEVELS)).toBe('II');
    expect(canonicalLevel('Gerencia', LEVELS)).toBeNull();
  });
});

describe('Listas cerradas · la escala es org_levels (I a IX)', () => {
  it('IX es válido; «ix», « IX » y «9» se leen como IX; X y XV ya no existen', () => {
    for (const v of ['IX', 'ix', ' IX ', '9']) expect(resolveLevel(v, LEVELS)).toEqual({ kind: 'ok', code: 'IX' });
    for (const v of ['X', '10', 'XV', '15', 'XVI']) expect(resolveLevel(v, LEVELS)).toEqual({ kind: 'invalid' });
    expect(LEVELS).toHaveLength(9);
  });
  it('lee los niveles de catalogs.org_levels (activos, por sort_order) y no de otro catálogo', async () => {
    const { service, calls } = build();
    await service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketplace', division: 'E-Commerce', level: 'III' }), ACTOR);
    const q = calls.find((c) => /FROM catalogs\.org_levels/.test(c.sql))!;
    expect(q.sql).toContain('is_active IS NOT FALSE');
    expect(q.sql).toContain('ORDER BY sort_order');
    expect(calls.some((c) => /job_position_levels/.test(c.sql))).toBe(false);
    const options = await service.getOptions();
    expect(options.levels.map((l) => l.code)).toEqual(LEVELS);
  });
  it('el API rechaza X con 400 y acepta IX («9»)', async () => {
    const { service } = build();
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketplace', division: 'E-Commerce', level: 'X' }), ACTOR)).rejects.toThrow(/I, II, III, IV, V, VI, VII, VIII, IX/);
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketplace', division: 'E-Commerce', level: '9' }), ACTOR)).resolves.toBeDefined();
  });
});

describe('Listas cerradas · categoría', () => {
  it('«semi-senior», «SEMI SENIOR» y «Semi Senior» son lo mismo', () => {
    for (const v of ['semi-senior', 'SEMI SENIOR', 'Semi Senior', 'semi_senior', 'Semí Senior']) expect(parseSeniority(v)).toBe('semi_senior');
    expect(parseSeniority('JUNIOR')).toBe('junior');
    expect(parseSeniority('sénior')).toBe('senior');
    expect(parseSeniority('Lead')).toBeNull();
    expect(parseSeniority('')).toBeNull();
  });
  it('se lee de un texto más largo (MEOT) y «Semi Senior» no se confunde con «Senior»', () => {
    expect(seniorityFromText('Especialista Semi Senior (MEOT)')).toBe('semi_senior');
    expect(seniorityFromText('Especialista Semi-Senior')).toBe('semi_senior');
    expect(seniorityFromText('Especialista Senior')).toBe('senior');
    expect(seniorityFromText('Operativo Junior')).toBe('junior');
    expect(seniorityFromText('Liderazgo Operativo')).toBeNull();
    expect(seniorityFromText('Dirección')).toBeNull();
    expect(seniorityFromText(null)).toBeNull();
  });
});

describe('Listas cerradas · área', () => {
  const areas = [
    { name: 'Marketplace', divisionName: 'E-Commerce' },
    { name: 'Marketplace – Cuentas Clave', divisionName: 'E-Commerce' },
    { name: 'Marketplace', divisionName: 'Otra' },
  ];
  it('la clave ignora mayúsculas, acentos, espacios y puntuación', () => {
    expect(areaKey(' Marketplace  ')).toBe('marketplace');
    expect(areaKey('Dirección  E-Commerce')).toBe('direccion e commerce');
    expect(areaKey('Marketplace – Cuentas Clave')).toBe(areaKey('marketplace - cuentas clave'));
  });
  it('exacta: solo de la misma división, sin mayúsculas, acentos ni espacios extra', () => {
    expect(findAreaExact(areas, 'E-Commerce', ' marketplace ')?.name).toBe('Marketplace');
    expect(findAreaExact(areas, ' e-commerce ', 'MARKETPLACE – cuentas clave')?.name).toBe('Marketplace – Cuentas Clave');
    expect(findAreaExact(areas, 'Finanzas', 'Marketplace')).toBeNull();
    expect(findAreaExact(areas, 'E-Commerce', '')).toBeNull();
  });
  it('casi igual: una letra de diferencia, nunca la idéntica', () => {
    expect(findAreaNear(areas, 'E-Commerce', 'Marketplaces')?.name).toBe('Marketplace');
    expect(findAreaNear(areas, 'E-Commerce', 'Markeplace')?.name).toBe('Marketplace');
    expect(findAreaNear(areas, 'E-Commerce', 'Marketplace')).toBeNull();
    expect(findAreaNear(areas, 'E-Commerce', 'Performance')).toBeNull();
  });
  it('áreas casi duplicadas dentro de una división', () => {
    const pairs = nearDuplicateAreas([
      { name: 'Soporte', divisionName: 'Ops' }, { name: 'soporte ', divisionName: 'Ops' }, { name: 'Soportes', divisionName: 'Ops' }, { name: 'Soporte', divisionName: 'Otra' },
    ]);
    expect(pairs.map(([a, b]) => [a.name, b.name])).toEqual([['Soporte', 'soporte '], ['Soporte', 'Soportes'], ['soporte ', 'Soportes']]);
  });
});

/** Base falsa mínima para el servicio de puestos. */
function build(opts: { areas?: { name: string; division_name: string | null }[]; current?: Record<string, unknown> } = {}) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const areas = opts.areas ?? [{ name: 'Marketplace', division_name: 'E-Commerce' }];
  const current = opts.current ?? {
    id: 'p1', code: 'JP-001', title: 'TEST-Puesto', area: 'Marketplace', business_unit: null, level: 'II', description: 'TEST-Descripción', description_approved: false,
    description_approved_by: null, description_approved_at: null, status: 'activo', division: 'E-Commerce', level_original: null, seniority: null,
    meot_hierarchy: null, reports_to_text: null, reports_to_employee_id: null, plazas: 1, role_summary: 'TEST-Rol', position_objective: 'TEST-Objetivo', validation_points: 'TEST-Puntos',
    head_comments: null, validation_status: 'pendiente', validated_by: null, validated_at: null, created_at: new Date(), updated_at: new Date(),
  };
  const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    if (/FROM catalogs\.org_levels/.test(sql)) return LEVELS.map((code) => ({ code, name: `Nivel ${code}` }));
    if (/^SELECT name FROM catalogs\.divisions/.test(sql)) return ['E-Commerce', 'Finanzas', 'Otra'].map((name) => ({ name }));
    if (/^SELECT name, division_name FROM catalogs\.areas/.test(sql)) return areas;
    if (/^INSERT INTO catalogs\.areas/.test(sql)) {
      areas.push({ name: params[0] as string, division_name: params[1] as string });
      return [];
    }
    if (/SELECT code FROM hr\.job_positions/.test(sql)) return [];
    if (/INSERT INTO hr\.job_positions/.test(sql)) return [{ id: 'p1' }];
    if (/FOR UPDATE/.test(sql) || /^SELECT p\.\*/.test(sql)) return [current];
    return [];
  });
  const dataSource = { query, transaction: async (cb: (m: unknown) => Promise<unknown>) => cb({ query }) };
  const audit = { logActivity: jest.fn() };
  return { service: new JobPositionsService(dataSource as never, audit as never), calls, audit, areas };
}

describe('Matriz de Puestos · el API rechaza texto libre en nivel y área (400)', () => {
  it('nivel fuera del catálogo al crear: 400', async () => {
    const { service } = build();
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketplace', division: 'E-Commerce', level: 'Gerencia' }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketplace', division: 'E-Commerce', level: 'XVI' }), ACTOR)).rejects.toThrow(/debe ser uno de la lista/);
  });
  it('área fuera del catálogo de la división al crear: 400; con la división correcta, se guarda el nombre canónico', async () => {
    const { service, calls } = build();
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketing', division: 'E-Commerce' }), ACTOR)).rejects.toThrow(/no está en el catálogo de la división/);
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Marketplace', division: 'Otra' }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: ' marketplace ', division: 'E-Commerce', level: 'iv' }), ACTOR);
    const insert = calls.find((c) => /^INSERT INTO hr\.job_positions/.test(c.sql))!;
    expect(insert.params[2]).toBe('Marketplace');
    expect(insert.params[4]).toBe('IV');
  });
  it('sin división, el área debe existir en el catálogo con ese nombre', async () => {
    const { service } = build();
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'Inventada' }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(plainToInstance(CreatePositionDto, { ...REQ, title: 'A', area: 'MARKETPLACE' }), ACTOR)).resolves.toBeDefined();
  });
  it('al editar solo se revalida lo que cambió: un puesto antiguo con nivel fuera de catálogo sigue editable', async () => {
    const legacy = {
      id: 'p1', code: 'JP-001', title: 'TEST-Viejo', area: 'Área Vieja', business_unit: null, level: 'Gerencia', description: 'TEST-Descripción', description_approved: false,
      description_approved_by: null, description_approved_at: null, status: 'activo', division: null, level_original: null, seniority: null,
      meot_hierarchy: null, reports_to_text: null, reports_to_employee_id: null, plazas: 1, role_summary: 'TEST-Rol', position_objective: 'TEST-Objetivo', validation_points: 'TEST-Puntos',
      head_comments: null, validation_status: 'pendiente', validated_by: null, validated_at: null, created_at: new Date(), updated_at: new Date(),
    };
    const { service, calls } = build({ current: legacy });
    await service.update('p1', { title: 'TEST-Viejo editado', level: 'Gerencia', area: 'Área Vieja' }, ACTOR);
    const up = calls.find((c) => /^UPDATE hr\.job_positions SET title/.test(c.sql))!;
    expect(up.params.slice(1, 3)).toEqual(['TEST-Viejo editado', 'Área Vieja']);
    // pero cambiarlos a otro valor libre sí se rechaza
    await expect(service.update('p1', { level: 'Otro' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('p1', { area: 'Otra Área Libre' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('cambiar la división revalida el área contra la división nueva', async () => {
    const { service } = build();
    await expect(service.update('p1', { division: 'Finanzas' }, ACTOR)).rejects.toThrow(/no está en el catálogo de la división «Finanzas»/);
    await expect(service.update('p1', { division: 'E-Commerce', level: 'III' }, ACTOR)).resolves.toBeDefined();
  });
  it('la categoría se valida con lista cerrada en el DTO', async () => {
    const errs = async (plain: object) => (await validate(plainToInstance(UpdatePositionDto, plain))).map((e) => e.property);
    expect(await errs({ seniority: 'semi_senior' })).toEqual([]);
    expect(await errs({ seniority: 'Lead' })).toEqual(['seniority']);
    expect(await errs({ seniority: '' })).toEqual([]);
  });
  it('guarda la categoría al editar y deja el cambio en la auditoría', async () => {
    const { service, calls, audit } = build();
    await service.update('p1', { seniority: 'senior' }, ACTOR);
    const up = calls.find((c) => /^UPDATE hr\.job_positions SET title/.test(c.sql))!;
    expect(up.params[21]).toBe('senior');
    expect(audit.logActivity.mock.calls[0]![0].changes.seniority).toEqual({ from: null, to: 'senior' });
  });
});

describe('Matriz de Puestos · agregar un área al catálogo', () => {
  it('crea el área y deja auditoría explícita', async () => {
    const { service, areas, audit } = build();
    const r = await service.createArea({ division: 'E-Commerce', name: '  Social   Commerce ' }, ACTOR);
    expect(r).toEqual({ created: true, area: { name: 'Social Commerce', division: 'E-Commerce' } });
    expect(areas.map((a) => a.name)).toContain('Social Commerce');
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entityType: 'catalog_area', module: 'matriz-puestos', userId: 'user-1', entityName: 'E-Commerce · Social Commerce' }));
  });
  it('si ya existe una igual (sin mayúsculas, acentos ni espacios) devuelve esa y no crea ni audita', async () => {
    const { service, areas, audit } = build();
    const r = await service.createArea({ division: 'E-Commerce', name: ' MARKETPLACE ' }, ACTOR);
    expect(r).toEqual({ created: false, area: { name: 'Marketplace', division: 'E-Commerce' } });
    expect(areas).toHaveLength(1);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });
  it('si hay una casi igual responde 409 con la sugerencia; con confirmación la crea', async () => {
    const { service, areas } = build();
    const err = await service.createArea({ division: 'E-Commerce', name: 'Marketplaces' }, ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ suggestion: 'Marketplace' });
    expect(areas).toHaveLength(1);
    const ok = await service.createArea({ division: 'E-Commerce', name: 'Marketplaces', confirmSimilar: true }, ACTOR);
    expect(ok.created).toBe(true);
    expect(areas).toHaveLength(2);
  });
  it('un nombre vacío se rechaza y la ruta exige update de la Matriz', async () => {
    const { service } = build();
    await expect(service.createArea({ division: 'E-Commerce', name: '   ' }, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    const perm = Reflect.getMetadata(PERMISSION_KEY, (JobPositionsController.prototype as unknown as Record<string, object>)['createArea']!);
    expect(perm).toEqual({ section: 'rrhh', module: 'matriz-puestos', action: 'update' });
  });
});
