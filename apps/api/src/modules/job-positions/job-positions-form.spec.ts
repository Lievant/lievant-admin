import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreatePositionDto, EmployeeSearchQueryDto, UpdatePositionDto } from './dto/job-position.dto';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsService } from './job-positions.service';
import { REQUIRED_POSITION_FIELDS, missingRequiredFields, toDetail, type PositionRow } from './job-positions.util';

const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };
const FULL = { roleSummary: 'TEST-Rol', positionObjective: 'TEST-Objetivo', validationPoints: 'TEST-Puntos', description: 'TEST-Descripción' };
const E1 = '11111111-1111-4111-8111-111111111111';
const E2 = '22222222-2222-4222-8222-222222222222';

const baseRow = (over: Partial<PositionRow> = {}): PositionRow => ({
  id: 'p1', code: 'JP-001', title: 'TEST-Puesto', area: 'TI', business_unit: null, level: null, description: 'TEST-Descripción', description_approved: false,
  description_approved_by: null, description_approved_at: null, status: 'pendiente_aprobacion', division: null, level_original: null, seniority: null,
  meot_hierarchy: null, reports_to_text: 'Texto del Excel', reports_to_employee_id: null, plazas: 1, role_summary: 'TEST-Rol', position_objective: 'TEST-Objetivo',
  validation_points: 'TEST-Puntos', head_comments: null, validation_status: 'pendiente', validated_by: null, validated_at: null,
  created_at: new Date(), updated_at: new Date(), ...over,
});

function build(opts: { current?: PositionRow; activeEmployees?: string[]; employees?: Record<string, string> } = {}) {
  const current = opts.current ?? baseRow();
  const active = new Set(opts.activeEmployees ?? [E1, E2]);
  const names = opts.employees ?? { [E1]: 'TEST-Ana', [E2]: 'TEST-Beto' };
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    if (/FROM catalogs\.org_levels/.test(sql)) return [{ code: 'I' }, { code: 'II' }];
    if (/FROM catalogs\.areas/.test(sql)) return [{ name: 'TI', division_name: null }];
    if (/SELECT code FROM hr\.job_positions/.test(sql)) return [];
    if (/INSERT INTO hr\.job_positions/.test(sql)) return [{ id: 'p1' }];
    if (/status = 'active' AND deleted_at IS NULL$/.test(sql) && /SELECT 1 FROM employees\.employee_records/.test(sql)) return active.has(params[0] as string) ? [{}] : [];
    if (/SELECT full_name FROM employees\.employee_records/.test(sql)) return [{ full_name: names[params[0] as string] }];
    if (/FOR UPDATE/.test(sql) || /^SELECT p\.\*/.test(sql)) return [current];
    if (/FROM employees\.employee_records WHERE status = 'active'/.test(sql)) {
      return [{ id: E1, full_name: 'TEST-Ana', position: 'Analista', area: 'TI', corporate_email: 'x@y.com', salary: 99 }];
    }
    return [];
  });
  const dataSource = { query, transaction: async (cb: (m: unknown) => Promise<unknown>) => cb({ query }) };
  const audit = { logActivity: jest.fn() };
  return { service: new JobPositionsService(dataSource as never, audit as never), calls, audit };
}

const createDto = (over: Record<string, unknown> = {}) => plainToInstance(CreatePositionDto, { title: 'TEST-Nuevo', area: 'TI', ...FULL, ...over });
const updateCalls = (calls: { sql: string; params: unknown[] }[]) => calls.filter((c) => /^UPDATE hr\.job_positions SET title/.test(c.sql));

describe('Matriz de Puestos · campos obligatorios del formulario', () => {
  it('la lista de obligatorios: Rol, Objetivo, Puntos a validar y Descripción; vacío o solo espacios cuenta como faltante', () => {
    expect(REQUIRED_POSITION_FIELDS.map((f) => f.label)).toEqual(['Rol', 'Objetivo del puesto', 'Puntos a validar', 'Descripción del puesto']);
    expect(missingRequiredFields(FULL)).toEqual([]);
    expect(missingRequiredFields({ ...FULL, roleSummary: '   ' }).map((f) => f.key)).toEqual(['roleSummary']);
    expect(missingRequiredFields({}).map((f) => f.key)).toEqual(['roleSummary', 'positionObjective', 'validationPoints', 'description']);
  });

  it.each([
    ['roleSummary', 'El rol es obligatorio'],
    ['positionObjective', 'El objetivo del puesto es obligatorio'],
    ['validationPoints', 'Los puntos a validar son obligatorios'],
    ['description', 'La descripción del puesto es obligatoria'],
  ])('crear sin %s: 400 con su mensaje', async (key, message) => {
    const { service } = build();
    const err = await service.create(createDto({ [key]: '' }), ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ message: [message] });
  });

  it('crear sin ninguno: 400 con un mensaje por cada campo faltante', async () => {
    const { service } = build();
    const err = await service.create(plainToInstance(CreatePositionDto, { title: 'A', area: 'TI' }), ACTOR).catch((e) => e);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      message: ['El rol es obligatorio', 'El objetivo del puesto es obligatorio', 'Los puntos a validar son obligatorios', 'La descripción del puesto es obligatoria'],
    });
  });

  it('crear con todo lleno funciona', async () => {
    const { service } = build();
    await expect(service.create(createDto(), ACTOR)).resolves.toBeDefined();
  });

  it('editar desde el formulario un puesto antiguo al que le faltan campos: 400 con los que faltan', async () => {
    const old = baseRow({ role_summary: null, position_objective: null, validation_points: 'TEST-Puntos', description: null });
    const { service, calls } = build({ current: old });
    const err = await service.update('p1', { title: 'TEST-Nuevo título' }, ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      message: ['El rol es obligatorio', 'El objetivo del puesto es obligatorio', 'La descripción del puesto es obligatoria'],
    });
    expect(updateCalls(calls)).toHaveLength(0);
    // llenándolos, se guarda
    await expect(service.update('p1', { title: 'TEST-Nuevo título', ...FULL }, ACTOR)).resolves.toBeDefined();
    expect(updateCalls(calls)).toHaveLength(1);
  });

  it('un puesto antiguo sin esos campos se puede abrir (detalle) y cambiar la validación del Head no se bloquea', async () => {
    const old = baseRow({ role_summary: null, position_objective: null, validation_points: null, description: null });
    const { service, calls } = build({ current: old });
    const detail = await service.getDetail('p1');
    expect(detail.roleSummary).toBeNull();
    expect(detail.hasDescription).toBe(false);
    await expect(service.update('p1', { validationStatus: 'validado', headComments: 'Visto bueno' }, ACTOR)).resolves.toBeDefined();
    expect(updateCalls(calls)).toHaveLength(1);
    await expect(service.update('p1', { validationStatus: 'rechazado' }, ACTOR)).resolves.toBeDefined();
  });

  it('el DTO ya validado trae propiedades en undefined: cambiar solo la validación sigue sin exigir los obligatorios', async () => {
    const old = baseRow({ role_summary: null, position_objective: null, validation_points: null, description: null });
    const { service } = build({ current: old });
    const dto = Object.assign(new UpdatePositionDto(), { title: undefined, area: undefined, plazas: undefined, validationStatus: 'validado' as const });
    expect(Object.keys(dto)).toContain('title');
    await expect(service.update('p1', dto, ACTOR)).resolves.toBeDefined();
  });

  it('el aprobar la descripción no pasa por la validación de obligatorios', async () => {
    const old = baseRow({ role_summary: null, description: 'Texto' });
    const { service } = build({ current: old });
    await expect(service.approveDescription('p1', ACTOR)).resolves.toBeDefined();
  });
});

describe('Matriz de Puestos · «Reporta a» como empleado', () => {
  it('guarda el empleado, deja el cambio en la auditoría con nombres y no toca el texto del Excel', async () => {
    const { service, calls, audit } = build();
    await service.update('p1', { ...FULL, reportsToEmployeeId: E1 }, ACTOR);
    const up = updateCalls(calls)[0]!;
    expect(up.params[22]).toBe(E1);
    expect(up.params[12]).toBe('Texto del Excel');
    expect(audit.logActivity.mock.calls[0]![0].changes.reportsToEmployee).toEqual({ from: null, to: 'TEST-Ana' });
  });

  it('cambiar y quitar el jefe también quedan en la auditoría', async () => {
    const { service, calls, audit } = build({ current: baseRow({ reports_to_employee_id: E1 }) });
    await service.update('p1', { ...FULL, reportsToEmployeeId: E2 }, ACTOR);
    expect(audit.logActivity.mock.calls[0]![0].changes.reportsToEmployee).toEqual({ from: 'TEST-Ana', to: 'TEST-Beto' });
    await service.update('p1', { ...FULL, reportsToEmployeeId: null }, ACTOR);
    expect(updateCalls(calls)[1]!.params[22]).toBeNull();
    expect(audit.logActivity.mock.calls[1]![0].changes.reportsToEmployee).toEqual({ from: 'TEST-Ana', to: null });
  });

  it('solo empleados activos: uno inexistente o dado de baja da 400; al crear también', async () => {
    const { service } = build({ activeEmployees: [E1] });
    await expect(service.update('p1', { ...FULL, reportsToEmployeeId: E2 }, ACTOR)).rejects.toThrow(/no existe o no está activo/);
    await expect(service.create(createDto({ reportsToEmployeeId: E2 }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(createDto({ reportsToEmployeeId: E1 }), ACTOR)).resolves.toBeDefined();
  });

  it('un jefe que ya no está activo no impide guardar otros cambios (solo se revalida si cambia)', async () => {
    const { service } = build({ current: baseRow({ reports_to_employee_id: E2 }), activeEmployees: [E1] });
    await expect(service.update('p1', { ...FULL, title: 'TEST-Otro', reportsToEmployeeId: E2 }, ACTOR)).resolves.toBeDefined();
  });

  it('el detalle muestra al jefe con su cargo, y «Baja» cuando ya no está activo', () => {
    const active = toDetail(baseRow({ reports_to_employee_id: E1, reports_to_name: 'TEST-Ana', reports_to_position: 'Analista', reports_to_active: true }), [], []);
    expect(active.reportsToEmployee).toEqual({ id: E1, fullName: 'TEST-Ana', position: 'Analista', active: true });
    expect(active.reportsTo).toBe('Texto del Excel');
    const gone = toDetail(baseRow({ reports_to_employee_id: E1, reports_to_name: 'TEST-Ana', reports_to_position: 'Analista', reports_to_active: false }), [], []);
    expect(gone.reportsToEmployee!.active).toBe(false);
    expect(toDetail(baseRow(), [], []).reportsToEmployee).toBeNull();
    expect(toDetail(baseRow(), [], [])).not.toHaveProperty('supervises');
  });

  it('el DTO acepta un UUID o null y rechaza otra cosa; «Supervisa a» ya no se acepta', async () => {
    const errs = async (plain: object) => (await validate(plainToInstance(UpdatePositionDto, plain, {}), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);
    expect(await errs({ reportsToEmployeeId: E1 })).toEqual([]);
    expect(await errs({ reportsToEmployeeId: null })).toEqual([]);
    expect(await errs({ reportsToEmployeeId: 'no-es-uuid' })).toEqual(['reportsToEmployeeId']);
    expect(await errs({ supervises: 'Alguien' })).toEqual(['supervises']);
  });
});

describe('Matriz de Puestos · buscador de empleados para «Reporta a»', () => {
  it('exige update de la Matriz y se declara antes de las rutas con :id', () => {
    const proto = JobPositionsController.prototype as unknown as Record<string, object>;
    expect(Reflect.getMetadata(PERMISSION_KEY, proto['searchEmployees']!)).toEqual({ section: 'rrhh', module: 'matriz-puestos', action: 'update' });
    const names = Object.getOwnPropertyNames(JobPositionsController.prototype);
    expect(names.indexOf('searchEmployees')).toBeLessThan(names.indexOf('detail'));
  });

  it('devuelve solo id, nombre, cargo y área (nada sensible), de empleados activos y con tope de 10', async () => {
    const { service, calls } = build();
    const rows = await service.searchEmployees('  an ', 50);
    expect(rows).toEqual([{ id: E1, fullName: 'TEST-Ana', position: 'Analista', area: 'TI' }]);
    expect(Object.keys(rows[0]!).sort()).toEqual(['area', 'fullName', 'id', 'position']);
    const q = calls.find((c) => /FROM employees\.employee_records WHERE status = 'active'/.test(c.sql))!;
    expect(q.sql).toContain('deleted_at IS NULL');
    expect(q.sql).toContain('LIKE');
    expect(q.sql).toContain("translate(lower(full_name), 'áéíóúüñ', 'aeiouun')");
    expect(q.sql).not.toMatch(/salary|corporate_email|phone|curp|rfc/i);
    expect(q.params).toEqual(['%an%', 10]);
  });

  it('con menos de 2 letras no consulta nada', async () => {
    const { service, calls } = build();
    expect(await service.searchEmployees('a')).toEqual([]);
    expect(await service.searchEmployees('   ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('escapa los comodines del texto buscado y el DTO limita el tope a 10', async () => {
    const { service, calls } = build();
    await service.searchEmployees('50%_x');
    expect(calls[0]!.params[0]).toBe('%50\\%\\_x%');
    const errs = async (plain: object) => (await validate(plainToInstance(EmployeeSearchQueryDto, plain))).map((e) => e.property);
    expect(await errs({ q: 'ana', limit: '10' })).toEqual([]);
    expect(await errs({ q: 'ana', limit: '11' })).toEqual(['limit']);
  });
});
