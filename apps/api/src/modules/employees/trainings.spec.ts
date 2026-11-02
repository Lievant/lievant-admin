import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreateTrainingDto, TrainingQueryDto, UpdateTrainingDto } from './dto/training.dto';
import { EmployeesController } from './employees.controller';
import { MyProfileService } from './my-profile.service';
import { TrainingsService } from './trainings.service';
import {
  DEVELOPMENT_TYPES,
  DURATION_UNITS,
  TRAINING_LEVELS,
  buildTrainingFilter,
  firstReturnedRow,
  isRealDate,
  toMyTrainingView,
  toTrainingView,
  trainingPrefix,
  validateTraining,
  type TrainingRow,
} from './trainings.util';

const EMP_A = '11111111-1111-4111-8111-111111111111';
const EMP_B = '22222222-2222-4222-8222-222222222222';
const T1 = '33333333-3333-4333-8333-333333333333';
const ACTOR = { id: 'rrhh-1', email: 'rrhh@lievant.com', name: 'RRHH' };

function row(over: Partial<TrainingRow> = {}): TrainingRow {
  return {
    id: T1,
    employee_id: EMP_A,
    name: 'Curso de SQL',
    institution: 'Platzi',
    development_type: 'tecnico',
    level: 'basico',
    start_date: '2026-03-01',
    end_date: null,
    duration_value: 20,
    duration_unit: 'horas',
    certificate_s3_key: `employees/${EMP_A}/trainings/abc/1-cert.pdf`,
    certificate_original_name: 'cert.pdf',
    notes: 'nota interna de RRHH',
    created_at: new Date(),
    updated_at: new Date(),
    ...over,
  };
}

const base = { developmentType: 'tecnico', level: null, startDate: '2026-03-01', endDate: null, durationValue: null, durationUnit: null };

describe('Capacitaciones · validaciones de negocio', () => {
  it('acepta una capacitación válida y una en curso (sin fecha de fin)', () => {
    expect(() => validateTraining(base)).not.toThrow();
    expect(() => validateTraining({ ...base, endDate: '2026-03-01', durationValue: 3, durationUnit: 'meses' })).not.toThrow();
  });

  it('rechaza fecha de fin menor que la de inicio', () => {
    expect(() => validateTraining({ ...base, endDate: '2026-02-28' })).toThrow(/fecha de fin/);
  });

  it('rechaza fechas que no existen en el calendario', () => {
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(isRealDate('2026-3-1')).toBe(false);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(() => validateTraining({ ...base, startDate: '2026-02-30' })).toThrow(BadRequestException);
  });

  it('la duración exige número y unidad juntos o ninguno', () => {
    expect(() => validateTraining({ ...base, durationValue: 5 })).toThrow(/duración/);
    expect(() => validateTraining({ ...base, durationUnit: 'horas' })).toThrow(/duración/);
    expect(() => validateTraining({ ...base, durationValue: 0, durationUnit: 'horas' })).toThrow();
    expect(() => validateTraining({ ...base, durationValue: 1.5, durationUnit: 'horas' })).toThrow();
    expect(() => validateTraining({ ...base, durationValue: 2, durationUnit: 'semanas' as never })).toThrow(/unidad/);
  });

  it('rechaza tipo y nivel fuera de catálogo', () => {
    expect(() => validateTraining({ ...base, developmentType: 'otro' })).toThrow(/tipo de desarrollo/);
    expect(() => validateTraining({ ...base, level: 'experto' })).toThrow(/nivel/);
  });
});

describe('Capacitaciones · DTO', () => {
  const ok = { name: 'Curso', institution: 'Inst', developmentType: 'academico', startDate: '2026-01-10', competencyIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'] };
  const errorsOf = async (cls: new () => object, plain: object) =>
    (await validate(plainToInstance(cls, plain) as object)).map((e) => e.property);

  it('un cuerpo mínimo es válido', async () => {
    expect(await errorsOf(CreateTrainingDto, ok)).toEqual([]);
  });

  it('rechaza obligatorios vacíos, longitudes, tipo, nivel y unidad inválidos', async () => {
    expect(await errorsOf(CreateTrainingDto, { ...ok, name: '' })).toContain('name');
    expect(await errorsOf(CreateTrainingDto, { ...ok, name: 'x'.repeat(301) })).toContain('name');
    expect(await errorsOf(CreateTrainingDto, { ...ok, institution: 'x'.repeat(201) })).toContain('institution');
    expect(await errorsOf(CreateTrainingDto, { ...ok, developmentType: 'otro' })).toContain('developmentType');
    expect(await errorsOf(CreateTrainingDto, { ...ok, level: 'experto' })).toContain('level');
    expect(await errorsOf(CreateTrainingDto, { ...ok, durationValue: 3, durationUnit: 'semanas' })).toContain('durationUnit');
    expect(await errorsOf(CreateTrainingDto, { ...ok, durationValue: -2, durationUnit: 'horas' })).toContain('durationValue');
    expect(await errorsOf(CreateTrainingDto, { ...ok, startDate: '10/01/2026' })).toContain('startDate');
  });

  it('acepta nivel y fecha de fin nulos (limpiar) y rechaza campos desconocidos solo vía whitelist global', async () => {
    expect(await errorsOf(UpdateTrainingDto, { level: null, endDate: null, durationValue: null, durationUnit: null, certificate: null })).toEqual([]);
  });

  it('filtro: año y tipo válidos; tipo inválido rechazado', async () => {
    expect(await errorsOf(TrainingQueryDto, { type: 'tecnico', year: '2026' })).toEqual([]);
    expect(await errorsOf(TrainingQueryDto, { type: 'x' })).toContain('type');
  });
});

describe('Capacitaciones · filtros del listado', () => {
  it('siempre acota por empleado y excluye las dadas de baja', () => {
    const { where, params } = buildTrainingFilter(EMP_A, {});
    expect(where).toContain('employee_id = $1');
    expect(where).toContain('deleted_at IS NULL');
    expect(params).toEqual([EMP_A]);
  });

  it('agrega tipo y año de inicio', () => {
    const { where, params } = buildTrainingFilter(EMP_A, { type: 'academico', year: 2025 });
    expect(where).toContain('development_type = $2');
    expect(where).toContain('EXTRACT(YEAR FROM start_date) = $3');
    expect(params).toEqual([EMP_A, 'academico', 2025]);
  });
});

describe('Capacitaciones · forma de resultado de TypeORM', () => {
  it('firstReturnedRow entiende [filas, afectadas] y filas sueltas', () => {
    expect(firstReturnedRow([[{ a: 1 }], 1])).toEqual({ a: 1 });
    expect(firstReturnedRow([[], 0])).toBeUndefined();
    expect(firstReturnedRow([{ a: 2 }])).toEqual({ a: 2 });
    expect(firstReturnedRow([])).toBeUndefined();
  });
});

describe('Capacitaciones · vistas (lista blanca)', () => {
  it('RRHH no recibe la llave de S3; solo hasCertificate', () => {
    const v = toTrainingView(row());
    expect(JSON.stringify(v)).not.toMatch(/s3|employees\/|created_by|updated_by|deleted/i);
    expect(v.hasCertificate).toBe(true);
    expect(v.inProgress).toBe(true);
  });

  it('el colaborador no recibe notas, llave de S3 ni campos de auditoría; las llaves son exactas', () => {
    const v = toMyTrainingView(row());
    expect(Object.keys(v).sort()).toEqual(
      ['competencies', 'durationUnit', 'durationValue', 'endDate', 'hasCertificate', 'id', 'inProgress', 'institution', 'level', 'name', 'startDate', 'developmentType'].sort(),
    );
    expect(JSON.stringify(v)).not.toMatch(/nota interna|s3|employees\//i);
  });

  it('"En curso" solo cuando no hay fecha de fin', () => {
    expect(toMyTrainingView(row({ end_date: '2026-04-01' })).inProgress).toBe(false);
  });
});

// ── Servicio con BD y S3 simulados ───────────────────────────────────────────

interface Q { sql: string; params: unknown[] }

interface CompRow { id: string; name: string; is_active: boolean; is_deleted: boolean; sort_order: number }
interface Link { training_id: string; competency_id: string }

const C1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const C2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const C3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const C_OFF = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
const C_DEL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
const C_NONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6';
const CATALOG: CompRow[] = [
  { id: C1, name: 'TEST-Liderazgo', is_active: true, is_deleted: false, sort_order: 2 },
  { id: C2, name: 'TEST-Comunicación', is_active: true, is_deleted: false, sort_order: 1 },
  { id: C3, name: 'TEST-Análisis', is_active: true, is_deleted: false, sort_order: 1 },
  { id: C_OFF, name: 'TEST-Inactiva', is_active: false, is_deleted: false, sort_order: 9 },
  { id: C_DEL, name: 'TEST-Eliminada', is_active: false, is_deleted: true, sort_order: 9 },
];

function setup(opts: { trainings?: TrainingRow[]; employeeExists?: boolean; objectSize?: number | null; links?: Link[] } = {}) {
  const queries: Q[] = [];
  const store = opts.trainings ?? [row()];
  const links: Link[] = [...(opts.links ?? [])];
  const dataSource = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      // Competencias: lectura de las ligadas, validación contra el catálogo y escritura de las ligas.
      if (/FROM employees\.training_competencies tc/.test(sql)) {
        const ids = params[0] as string[];
        return links
          .filter((l) => ids.includes(l.training_id))
          .map((l) => ({ training_id: l.training_id, ...CATALOG.find((c) => c.id === l.competency_id)! }))
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
          .map((c) => ({ training_id: c.training_id, id: c.id, name: c.name }));
      }
      if (/FROM catalogs\.competencies WHERE id = ANY/.test(sql)) return CATALOG.filter((c) => (params[0] as string[]).includes(c.id));
      if (/^\s*INSERT INTO employees\.training_competencies/.test(sql)) {
        for (const id of params[1] as string[]) if (!links.some((l) => l.training_id === params[0] && l.competency_id === id)) links.push({ training_id: params[0] as string, competency_id: id });
        return [];
      }
      if (/^\s*DELETE FROM employees\.training_competencies/.test(sql)) {
        for (let i = links.length - 1; i >= 0; i--) if (links[i]!.training_id === params[0] && !(params[1] as string[]).includes(links[i]!.competency_id)) links.splice(i, 1);
        return [];
      }
      if (/FROM employees\.employee_records/.test(sql)) {
        return opts.employeeExists === false ? [] : [{ id: params[0], full_name: 'Ana Pérez' }];
      }
      if (/^\s*SELECT/.test(sql) && /FROM employees\.employee_trainings/.test(sql)) {
        // findRow: id=$1, employee_id=$2 ; listRows: employee_id=$1
        if (/id = \$1 AND employee_id = \$2/.test(sql)) {
          return store.filter((t) => t.id === params[0] && t.employee_id === params[1]);
        }
        return store.filter((t) => t.employee_id === params[0]);
      }
      if (/^\s*INSERT/.test(sql)) return [row({ id: 'new', name: params[1] as string, certificate_s3_key: (params[9] as string) ?? null })];
      // Con el driver de Postgres, TypeORM devuelve [filas, afectadas] en UPDATE ... RETURNING.
      if (/^\s*UPDATE/.test(sql) && /deleted_at = NOW/.test(sql)) {
        const hit = store.filter((t) => t.id === params[0] && t.employee_id === params[1]);
        return [hit, hit.length];
      }
      if (/^\s*UPDATE/.test(sql)) {
        const hit = store.filter((t) => t.id === params[0] && t.employee_id === params[1]).map((t) => ({ ...t, name: params[2] as string }));
        return [hit, hit.length];
      }
      return [];
    }),
  };
  (dataSource as unknown as { transaction: unknown }).transaction = async (cb: (m: unknown) => Promise<unknown>) => {
    const snapshot = [...links];
    try {
      return await cb(dataSource);
    } catch (e) {
      links.splice(0, links.length, ...snapshot);
      throw e;
    }
  };
  const storage = {
    getPresignedUploadUrlForPrefix: jest.fn(async (_n: string, _t: string, prefix: string) => ({ uploadUrl: 'https://s3/put', s3Key: `${prefix}/x/1-f.pdf` })),
    getObjectSize: jest.fn(async () => (opts.objectSize === undefined ? 1000 : opts.objectSize)),
    deleteDocument: jest.fn(async () => undefined),
    getPresignedUrl: jest.fn(async (key: string, ttl?: number) => `https://s3/get/${key}?ttl=${ttl}`),
  };
  const audit = { logActivity: jest.fn(async () => undefined) };
  const service = new TrainingsService(dataSource as any, storage as any, audit as any);
  return { service, queries, storage, audit, dataSource, links };
}

const createDto = (over: object = {}) =>
  plainToInstance(CreateTrainingDto, { name: ' Curso nuevo ', institution: 'Inst', developmentType: 'tecnico', startDate: '2026-05-01', competencyIds: [C1], ...over });

describe('Capacitaciones · servicio', () => {
  it('crea con datos válidos, recorta el nombre y deja auditoría sin llaves de S3', async () => {
    const { service, audit } = setup();
    const res = await service.create(EMP_A, createDto(), ACTOR);
    expect(res.name).toBe('Curso nuevo');
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', module: 'empleados', entityType: 'employee_training', userId: 'rrhh-1' }),
    );
    expect(JSON.stringify((audit.logActivity.mock.calls[0] as unknown[])[0])).not.toMatch(/s3|employees\//);
  });

  it('un expediente inexistente: 404 y no escribe nada', async () => {
    const { service, queries } = setup({ employeeExists: false });
    await expect(service.create(EMP_A, createDto(), ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    expect(queries.some((q) => /INSERT/.test(q.sql))).toBe(false);
  });

  it('crear con fechas incoherentes o duración incompleta se rechaza antes de guardar', async () => {
    const { service, queries } = setup();
    await expect(service.create(EMP_A, createDto({ endDate: '2026-04-01' }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(EMP_A, createDto({ durationValue: 3 }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(queries.some((q) => /INSERT/.test(q.sql))).toBe(false);
  });

  it('PATCH valida el estado combinado: mover el inicio después del fin guardado falla', async () => {
    const { service } = setup({ trainings: [row({ end_date: '2026-03-10' })] });
    await expect(service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { startDate: '2026-04-01' }), ACTOR)).rejects.toThrow(/fecha de fin/);
  });

  it('PATCH/DELETE de la capacitación de OTRO empleado por :id → 404 y nada se modifica', async () => {
    const { service, audit } = setup({ trainings: [row({ employee_id: EMP_B })] });
    await expect(service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { name: 'Hack' }), ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(EMP_A, T1, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getCertificateUrl(EMP_A, T1)).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('PATCH propio devuelve la capacitación actualizada con la forma real de TypeORM', async () => {
    const { service } = setup();
    const res = await service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { name: 'Nuevo nombre' }), ACTOR);
    expect(res.name).toBe('Nuevo nombre');
    expect(res.id).toBe(T1);
  });

  it('eliminar es baja lógica (deleted_at), nunca DELETE físico, y deja auditoría', async () => {
    const { service, queries, audit } = setup();
    await service.remove(EMP_A, T1, ACTOR);
    const q = queries.find((x) => /UPDATE employees\.employee_trainings/.test(x.sql))!;
    expect(q.sql).toContain('deleted_at = NOW()');
    expect(queries.some((x) => /DELETE FROM employees\.employee_trainings/.test(x.sql))).toBe(false);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', entityId: T1 }));
  });

  it('una capacitación ya borrada no se lista ni se descarga: toda consulta filtra deleted_at IS NULL', async () => {
    const { service, queries } = setup({ trainings: [] });
    await service.list(EMP_A, {});
    await expect(service.getCertificateUrl(EMP_A, T1)).rejects.toBeInstanceOf(NotFoundException);
    const selects = queries.filter((q) => /FROM employees\.employee_trainings/.test(q.sql));
    expect(selects.length).toBeGreaterThan(0);
    expect(selects.every((q) => q.sql.includes('deleted_at IS NULL'))).toBe(true);
  });

  it('descarga con URL de vida corta; sin certificado → 404', async () => {
    const ok = setup();
    const res = await ok.service.getCertificateUrl(EMP_A, T1);
    expect(res.url).toContain('ttl=300');
    const none = setup({ trainings: [row({ certificate_s3_key: null, certificate_original_name: null })] });
    await expect(none.service.getCertificateUrl(EMP_A, T1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la URL de subida usa el prefijo del empleado y solo admite PDF/JPEG/PNG de hasta 20 MB', async () => {
    const { service, storage } = setup();
    const res = await service.createCertificateUpload(EMP_A, { fileName: 'c.pdf', fileType: 'application/pdf', fileSize: 1000 });
    expect(res.s3Key.startsWith(trainingPrefix(EMP_A))).toBe(true);
    expect(storage.getPresignedUploadUrlForPrefix).toHaveBeenCalledWith('c.pdf', 'application/pdf', trainingPrefix(EMP_A));
    await expect(service.createCertificateUpload(EMP_A, { fileName: 'c.docx', fileType: 'application/msword', fileSize: 10 })).rejects.toThrow(/no permitido/);
    await expect(service.createCertificateUpload(EMP_A, { fileName: 'c.pdf', fileType: 'application/pdf', fileSize: 21 * 1024 * 1024 })).rejects.toThrow(/20 MB/);
  });

  it('al guardar con certificado: la key debe ser del empleado, existir y no pasar de 20 MB', async () => {
    const cert = (s3Key: string) => ({ s3Key, fileName: 'c.pdf', fileType: 'application/pdf', fileSize: 10 });
    const own = setup();
    await expect(own.service.create(EMP_A, createDto({ certificate: cert(`${trainingPrefix(EMP_A)}/u/1-c.pdf`) }), ACTOR)).resolves.toBeDefined();

    const foreign = setup();
    await expect(foreign.service.create(EMP_A, createDto({ certificate: cert(`${trainingPrefix(EMP_B)}/u/1-c.pdf`) }), ACTOR)).rejects.toThrow(/no es válida/);

    const missing = setup({ objectSize: null });
    await expect(missing.service.create(EMP_A, createDto({ certificate: cert(`${trainingPrefix(EMP_A)}/u/1-c.pdf`) }), ACTOR)).rejects.toThrow(/no se encontró/);

    const big = setup({ objectSize: 25 * 1024 * 1024 });
    await expect(big.service.create(EMP_A, createDto({ certificate: cert(`${trainingPrefix(EMP_A)}/u/1-c.pdf`) }), ACTOR)).rejects.toThrow(/20 MB/);
    expect(big.storage.deleteDocument).toHaveBeenCalled();
  });

  it('reemplazar o quitar el certificado borra el archivo anterior de S3', async () => {
    const quit = setup();
    await quit.service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { certificate: null }), ACTOR);
    expect(quit.storage.deleteDocument).toHaveBeenCalledWith(`employees/${EMP_A}/trainings/abc/1-cert.pdf`);
  });
});

// ── Mi Información: capacitaciones propias ───────────────────────────────────

describe('Mi Información · capacitaciones', () => {
  function mine() {
    const employees = [{ id: EMP_A, authUserId: 'user-a' }, { id: EMP_B, authUserId: 'user-b' }];
    const employeesRepo = { findOne: jest.fn(async ({ where }: any) => employees.find((e) => e.authUserId === where.authUserId) ?? null) };
    const trainings = {
      listMine: jest.fn(async (id: string) => [id]),
      getCertificateUrl: jest.fn(async () => ({ url: 'https://s3/x', fileName: 'x.pdf' })),
    };
    const service = new MyProfileService(employeesRepo as any, {} as any, {} as any, {} as any, trainings as any);
    return { service, trainings };
  }

  it('el empleado sale de la sesión: cada usuario consulta solo el suyo', async () => {
    const { service, trainings } = mine();
    await service.getTrainings('user-a', { type: 'tecnico' });
    await service.getTrainings('user-b', {});
    expect(trainings.listMine).toHaveBeenNthCalledWith(1, EMP_A, { type: 'tecnico' });
    expect(trainings.listMine).toHaveBeenNthCalledWith(2, EMP_B, {});
  });

  it('el certificado se pide con el empleado de la sesión, de modo que una capacitación ajena da 404', async () => {
    const { service, trainings } = mine();
    await service.getTrainingCertificateUrl('user-a', T1);
    expect(trainings.getCertificateUrl).toHaveBeenCalledWith(EMP_A, T1);
    // ... y sólo devuelve la URL, sin nombre de archivo ni llaves
    expect(await service.getTrainingCertificateUrl('user-a', T1)).toEqual({ url: 'https://s3/x' });
  });

  it('sin vínculo → 404 EMPLOYEE_NOT_LINKED', async () => {
    const { service } = mine();
    await expect(service.getTrainings('nadie', {})).rejects.toMatchObject({ status: 404 });
  });

  it('el servicio de capacitaciones no ofrece ningún método que reciba un id de empleado desde Mi Información', () => {
    expect(MyProfileService.prototype.getTrainings.length).toBe(2);
    expect(MyProfileService.prototype.getTrainingCertificateUrl.length).toBe(2);
  });
});

describe('Capacitaciones · permisos y rutas', () => {
  const proto = EmployeesController.prototype as any;
  const perm = (n: string) => Reflect.getMetadata(PERMISSION_KEY, proto[n]);

  it('lectura exige rrhh.capacitaciones.read; escrituras exigen write', () => {
    expect(perm('listTrainings')).toEqual({ section: 'rrhh', module: 'capacitaciones', action: 'read' });
    expect(perm('getTrainingCertificateUrl')).toEqual({ section: 'rrhh', module: 'capacitaciones', action: 'read' });
    for (const n of ['createTraining', 'createTrainingCertificateUpload', 'updateTraining', 'removeTraining']) {
      expect(perm(n)).toEqual({ section: 'rrhh', module: 'capacitaciones', action: 'write' });
    }
  });

  it('las rutas del colaborador son solo de sesión y van antes de las rutas con :id', () => {
    expect(perm('getMyTrainings')).toBeNull();
    expect(perm('getMyTrainingCertificateUrl')).toBeNull();
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('getMyTrainings')).toBeLessThan(order.indexOf('listTrainings'));
    expect(order.indexOf('getMyTrainingCertificateUrl')).toBeLessThan(order.indexOf('getTrainingCertificateUrl'));
  });
});

// ── Competencias de la capacitación ──────────────────────────────────────────

describe('Capacitaciones · competencias (DTO)', () => {
  const ok = { name: 'Curso', institution: 'Inst', developmentType: 'academico', startDate: '2026-01-10' };
  const errorsOf = async (cls: new () => object, plain: object) =>
    (await validate(plainToInstance(cls, plain) as object)).map((e) => e.property);
  const many = (n: number) => Array.from({ length: n }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`);

  it('el alta exige competencyIds con al menos 1', async () => {
    expect(await errorsOf(CreateTrainingDto, ok)).toContain('competencyIds');
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: [] })).toContain('competencyIds');
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: [C1] })).toEqual([]);
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: [C1, C2, C3] })).toEqual([]);
  });

  it('rechaza repetidas, ids que no son UUID y más de 30 (30 sí)', async () => {
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: [C1, C1] })).toContain('competencyIds');
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: ['no-uuid'] })).toContain('competencyIds');
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: many(30) })).toEqual([]);
    expect(await errorsOf(CreateTrainingDto, { ...ok, competencyIds: many(31) })).toContain('competencyIds');
  });

  it('en la edición es opcional, pero si se envía debe traer al menos 1 (vacío y null se rechazan)', async () => {
    expect(await errorsOf(UpdateTrainingDto, {})).toEqual([]);
    expect(await errorsOf(UpdateTrainingDto, { competencyIds: [C2] })).toEqual([]);
    expect(await errorsOf(UpdateTrainingDto, { competencyIds: [] })).toContain('competencyIds');
    expect(await errorsOf(UpdateTrainingDto, { competencyIds: null })).toContain('competencyIds');
    expect(await errorsOf(UpdateTrainingDto, { competencyIds: [C1, C1] })).toContain('competencyIds');
  });

  it('el mensaje de error está en español', async () => {
    const e = await validate(plainToInstance(CreateTrainingDto, { ...ok, competencyIds: [] }) as object);
    expect(JSON.stringify(e)).toContain('Selecciona al menos una competencia');
  });

  it('el DTO ya no conoce isCompanyRecognition', async () => {
    const strict = { whitelist: true, forbidNonWhitelisted: true };
    const e = await validate(plainToInstance(CreateTrainingDto, { ...ok, competencyIds: [C1], isCompanyRecognition: true }) as object, strict);
    expect(e.map((x) => x.property)).toEqual(['isCompanyRecognition']);
  });
});

describe('Capacitaciones · competencias (alta)', () => {
  it('sin competencias se rechaza y no se escribe nada', async () => {
    const { service, queries } = setup();
    await expect(service.create(EMP_A, createDto({ competencyIds: undefined }), ACTOR)).rejects.toThrow(/al menos una competencia/);
    await expect(service.create(EMP_A, createDto({ competencyIds: [] }), ACTOR)).rejects.toThrow(/al menos una competencia/);
    expect(queries.some((q) => /INSERT/.test(q.sql))).toBe(false);
  });

  it('con repetidas, con más de 30 o con ids inválidos se rechaza', async () => {
    const { service, queries } = setup();
    await expect(service.create(EMP_A, createDto({ competencyIds: [C1, C1] }), ACTOR)).rejects.toThrow(/repetidas/);
    const many = Array.from({ length: 31 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`);
    await expect(service.create(EMP_A, createDto({ competencyIds: many }), ACTOR)).rejects.toThrow(/más de 30/);
    await expect(service.create(EMP_A, createDto({ competencyIds: ['xx'] }), ACTOR)).rejects.toThrow(/no es válida/);
    expect(queries.some((q) => /INSERT/.test(q.sql))).toBe(false);
  });

  it('una competencia inexistente, eliminada o inactiva se rechaza y no queda la capacitación a medias', async () => {
    const { service, links } = setup();
    await expect(service.create(EMP_A, createDto({ competencyIds: [C1, C_NONE] }), ACTOR)).rejects.toThrow(/no existe/);
    await expect(service.create(EMP_A, createDto({ competencyIds: [C_DEL] }), ACTOR)).rejects.toThrow(/TEST-Eliminada.*eliminada/);
    await expect(service.create(EMP_A, createDto({ competencyIds: [C1, C_OFF] }), ACTOR)).rejects.toThrow(/TEST-Inactiva.*inactiva/);
    expect(links).toHaveLength(0);
  });

  it('con una válida y con varias: guarda las ligas y responde ordenadas por el orden del catálogo y luego por nombre', async () => {
    const one = setup();
    const a = await one.service.create(EMP_A, createDto({ competencyIds: [C1] }), ACTOR);
    expect(a.competencies).toEqual([{ id: C1, name: 'TEST-Liderazgo' }]);

    const many = setup();
    const b = await many.service.create(EMP_A, createDto({ competencyIds: [C1, C2, C3] }), ACTOR);
    // C2 y C3 comparten orden 1 (por nombre: Análisis antes que Comunicación); C1 tiene orden 2
    expect(b.competencies.map((c) => c.name)).toEqual(['TEST-Análisis', 'TEST-Comunicación', 'TEST-Liderazgo']);
    expect(many.links).toHaveLength(3);
    expect(b).not.toHaveProperty('isCompanyRecognition');
  });

  it('la capacitación y sus ligas van en una transacción y la auditoría anota los nombres de las competencias', async () => {
    const { service, audit, queries } = setup();
    await service.create(EMP_A, createDto({ competencyIds: [C1, C2] }), ACTOR);
    expect(queries.some((q) => /INSERT INTO employees\.training_competencies/.test(q.sql))).toBe(true);
    expect(queries.some((q) => /is_company_recognition/.test(q.sql))).toBe(false);
    const call = (audit.logActivity.mock.calls[0] as unknown[])[0] as { changes: { competencies: { to: string[] } } };
    expect(call.changes.competencies.to).toEqual(['TEST-Comunicación', 'TEST-Liderazgo']);
  });
});

describe('Capacitaciones · competencias (edición)', () => {
  const linked = (...ids: string[]): Link[] => ids.map((competency_id) => ({ training_id: T1, competency_id }));

  it('enviar competencyIds reemplaza el conjunto completo', async () => {
    const { service, links } = setup({ links: linked(C1, C2) });
    const res = await service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [C2, C3] }), ACTOR);
    expect(res.competencies.map((c) => c.id).sort()).toEqual([C2, C3].sort());
    expect(links.map((l) => l.competency_id).sort()).toEqual([C2, C3].sort());
  });

  it('no enviar competencyIds conserva las actuales (y no toca las ligas)', async () => {
    const { service, links, queries } = setup({ links: linked(C1, C2) });
    const res = await service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { name: 'Otro nombre' }), ACTOR);
    expect(res.competencies.map((c) => c.id).sort()).toEqual([C1, C2].sort());
    expect(links).toHaveLength(2);
    expect(queries.some((q) => /training_competencies/.test(q.sql) && /^\s*(INSERT|DELETE)/.test(q.sql))).toBe(false);
  });

  it('una capacitación vieja sin competencias se puede editar sin enviarlas', async () => {
    const { service } = setup();
    const res = await service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { institution: 'Nueva' }), ACTOR);
    expect(res.competencies).toEqual([]);
  });

  it('enviarlo vacío se rechaza y no cambia nada', async () => {
    const { service, links, audit } = setup({ links: linked(C1) });
    await expect(service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [] }), ACTOR)).rejects.toThrow(/al menos una competencia/);
    expect(links).toHaveLength(1);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('conserva una competencia inactiva que ya estaba ligada, pero no deja elegirla en otra capacitación', async () => {
    const kept = setup({ links: linked(C_OFF) });
    const ok = await kept.service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [C_OFF, C1] }), ACTOR);
    expect(ok.competencies.map((c) => c.id).sort()).toEqual([C1, C_OFF].sort());

    const other = setup(); // la capacitación no la tenía ligada
    await expect(other.service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [C_OFF] }), ACTOR)).rejects.toThrow(/TEST-Inactiva.*inactiva/);
  });

  it('rechaza inexistentes y eliminadas al editar, y deshace todo si falla (las ligas quedan como estaban)', async () => {
    const { service, links } = setup({ links: linked(C1) });
    await expect(service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [C_NONE] }), ACTOR)).rejects.toThrow(/no existe/);
    await expect(service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [C_DEL] }), ACTOR)).rejects.toThrow(/eliminada/);
    expect(links.map((l) => l.competency_id)).toEqual([C1]);
  });

  it('la auditoría registra el cambio de competencias por nombre', async () => {
    const { service, audit } = setup({ links: linked(C1) });
    await service.update(EMP_A, T1, plainToInstance(UpdateTrainingDto, { competencyIds: [C2] }), ACTOR);
    const call = (audit.logActivity.mock.calls[0] as unknown[])[0] as { changes: { competencies: { from: string[]; to: string[] } } };
    expect(call.changes.competencies).toEqual({ from: ['TEST-Liderazgo'], to: ['TEST-Comunicación'] });
  });
});

describe('Capacitaciones · competencias en las listas', () => {
  const linked = (...ids: string[]): Link[] => ids.map((competency_id) => ({ training_id: T1, competency_id }));

  it('RRHH ve las competencias de cada capacitación en una sola consulta, en orden de catálogo y nombre', async () => {
    const { service, queries } = setup({ links: linked(C1, C2, C3), trainings: [row(), row({ id: 'otra', name: 'Sin competencias' })] });
    const res = await service.list(EMP_A, {});
    expect(res.find((t) => t.id === T1)!.competencies.map((c) => c.name)).toEqual(['TEST-Análisis', 'TEST-Comunicación', 'TEST-Liderazgo']);
    expect(res.find((t) => t.id === 'otra')!.competencies).toEqual([]);
    expect(queries.filter((q) => /FROM employees\.training_competencies/.test(q.sql))).toHaveLength(1);
  });

  it('el colaborador ve las competencias de SUS capacitaciones, solo con id y nombre', async () => {
    const { service } = setup({ links: linked(C2) });
    const res = await service.listMine(EMP_A, {});
    expect(res[0]!.competencies).toEqual([{ id: C2, name: 'TEST-Comunicación' }]);
    expect(Object.keys(res[0]!.competencies[0]!).sort()).toEqual(['id', 'name']);
    expect(res[0]).not.toHaveProperty('isCompanyRecognition');
  });

  it('las vistas ya no traen isCompanyRecognition', () => {
    expect(toTrainingView(row())).not.toHaveProperty('isCompanyRecognition');
    expect(toTrainingView(row()).competencies).toEqual([]);
    expect(toMyTrainingView(row(), [{ id: C1, name: 'x' }]).competencies).toEqual([{ id: C1, name: 'x' }]);
  });
});

describe('Capacitaciones · listas ampliadas (tipo, nivel y unidad)', () => {
  const ok = { name: 'Curso', institution: 'Inst', developmentType: 'tecnico', startDate: '2026-01-10', competencyIds: [C1] };
  const errorsOf = async (cls: new () => object, plain: object) =>
    (await validate(plainToInstance(cls, plain) as object)).map((e) => e.property);

  it('las listas quedan en el orden pedido y conservan los valores anteriores', () => {
    expect([...DEVELOPMENT_TYPES]).toEqual(['tecnico', 'habilidades_blandas', 'academico', 'sgsi', 'bienestar_psicosocial']);
    expect([...TRAINING_LEVELS]).toEqual(['basico', 'intermedio', 'avanzado', 'especializacion', 'obligatoria']);
    expect([...DURATION_UNITS]).toEqual(['horas', 'dias', 'meses']);
  });

  it('los valores nuevos son válidos en el DTO de alta y de edición, y los viejos siguen válidos', async () => {
    for (const developmentType of ['tecnico', 'habilidades_blandas', 'academico', 'sgsi', 'bienestar_psicosocial']) {
      expect(await errorsOf(CreateTrainingDto, { ...ok, developmentType })).toEqual([]);
      expect(await errorsOf(UpdateTrainingDto, { developmentType })).toEqual([]);
    }
    for (const level of ['basico', 'intermedio', 'avanzado', 'especializacion', 'obligatoria', null]) {
      expect(await errorsOf(CreateTrainingDto, { ...ok, level })).toEqual([]);
    }
    for (const durationUnit of ['horas', 'dias', 'meses']) {
      expect(await errorsOf(CreateTrainingDto, { ...ok, durationValue: 5, durationUnit })).toEqual([]);
    }
  });

  it('un valor inventado se rechaza (tipo, nivel y unidad)', async () => {
    expect(await errorsOf(CreateTrainingDto, { ...ok, developmentType: 'otro' })).toContain('developmentType');
    expect(await errorsOf(CreateTrainingDto, { ...ok, level: 'experto' })).toContain('level');
    expect(await errorsOf(CreateTrainingDto, { ...ok, durationValue: 3, durationUnit: 'semanas' })).toContain('durationUnit');
    expect(await errorsOf(UpdateTrainingDto, { developmentType: 'SGSI' })).toContain('developmentType');
  });

  it('validateTraining acepta los nuevos y rechaza los inventados', () => {
    expect(() => validateTraining({ ...base, developmentType: 'sgsi', level: 'obligatoria', durationValue: 5, durationUnit: 'dias' })).not.toThrow();
    expect(() => validateTraining({ ...base, developmentType: 'bienestar_psicosocial' })).not.toThrow();
    expect(() => validateTraining({ ...base, level: 'otro' })).toThrow(/nivel/);
    expect(() => validateTraining({ ...base, durationValue: 2, durationUnit: 'semanas' as never })).toThrow(/unidad/);
    // la regla de que valor y unidad van juntos sigue igual con Días
    expect(() => validateTraining({ ...base, durationUnit: 'dias' })).toThrow(/duración/);
  });

  it('crear con tipo SGSI, nivel Obligatoria y duración en Días llega a la base con esos valores', async () => {
    const { service, queries } = setup();
    await service.create(EMP_A, createDto({ developmentType: 'sgsi', level: 'obligatoria', durationValue: 5, durationUnit: 'dias' }), ACTOR);
    const insert = queries.find((q) => /INSERT INTO employees\.employee_trainings/.test(q.sql))!;
    expect(insert.params.slice(3, 9)).toEqual(expect.arrayContaining(['sgsi', 'obligatoria', 5, 'dias']));
  });
});
