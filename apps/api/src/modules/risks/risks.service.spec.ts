import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreateRiskDto, UpdateRiskDto } from './dto/risk.dto';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_OWNER_ID = '33333333-3333-4333-8333-333333333333';
const actor = { id: 'u1', name: 'Leonardo', email: 'leonardo@lievant.com' } as any;

const valid = {
  category: 'Ciberseguridad (IT)',
  threat: 'Autenticacion',
  vulnerability: 'Falta factor MFA',
  affectedAsset: 'COR',
  risk: 'Acceso a información de clientes',
  vulnerabilityScore: 4,
  severityScore: 4,
  probabilityScore: 3,
  control: 'TIC-PO-03 Control 5.17',
  controlEfficacy: 0.3,
  ownerUserId: OWNER_ID,
  actionStatus: 'No iniciado',
};

// Misma configuración global que main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const bodyMeta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype });
const validate = (dto: any, metatype: any = CreateRiskDto) => pipe.transform(dto, bodyMeta(metatype));

describe('Validación del DTO', () => {
  it('acepta un riesgo válido con opcionales ausentes', async () => {
    await expect(validate(valid)).resolves.toBeDefined();
  });

  it.each([0, 6, 3.5, '3', null])('rechaza una vulnerabilidad de %p', async (valor) => {
    await expect(validate({ ...valid, vulnerabilityScore: valor })).rejects.toThrow(BadRequestException);
  });

  it.each(['severityScore', 'probabilityScore'])('rechaza %s fuera de rango', async (campo) => {
    await expect(validate({ ...valid, [campo]: 6 })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...valid, [campo]: 0 })).rejects.toThrow(BadRequestException);
  });

  it.each([0.25, 0.6, 0, 1, '0.3'])('rechaza la eficacia %p', async (valor) => {
    await expect(validate({ ...valid, controlEfficacy: valor })).rejects.toThrow(BadRequestException);
  });

  it('rechaza un estado inválido', async () => {
    await expect(validate({ ...valid, actionStatus: 'Terminado' })).rejects.toThrow(BadRequestException);
  });

  it.each(['category', 'threat', 'vulnerability', 'affectedAsset', 'risk', 'control'])(
    'rechaza %s vacío',
    async (campo) => {
      await expect(validate({ ...valid, [campo]: '   ' })).rejects.toThrow(BadRequestException);
    },
  );

  it('el dueño es obligatorio y debe ser un UUID', async () => {
    const { ownerUserId: _omit, ...sinDueno } = valid;
    await expect(validate(sinDueno)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...valid, ownerUserId: 'Paulo Ossa' })).rejects.toThrow(BadRequestException);
  });

  it('el dueño ya no se acepta como texto libre', async () => {
    await expect(validate({ ...valid, owner: 'Paulo Ossa' })).rejects.toThrow(BadRequestException);
  });

  it('rechaza una fecha con formato inválido', async () => {
    await expect(validate({ ...valid, estimatedResolutionDate: '31 de diciembre' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('el API ignora (rechaza) riskValue y residualRisk que mande el cliente', async () => {
    await expect(validate({ ...valid, riskValue: 1 })).rejects.toThrow(BadRequestException);
    await expect(validate({ ...valid, residualRisk: 0.1 })).rejects.toThrow(BadRequestException);
  });

  it('en la edición todos los campos son opcionales pero siguen validados', async () => {
    await expect(validate({ actionStatus: 'Resuelto' }, UpdateRiskDto)).resolves.toBeDefined();
    await expect(validate({ severityScore: 9 }, UpdateRiskDto)).rejects.toThrow(BadRequestException);
  });
});

interface OwnerRow {
  id: string;
  name: string;
  is_active: boolean;
}

function buildService(opts: { existing?: Record<string, unknown>; owners?: Record<string, OwnerRow> } = {}) {
  const row = opts.existing ? { ...opts.existing } : undefined;
  const owners = opts.owners ?? { [OWNER_ID]: { id: OWNER_ID, name: 'Paulo Ossa', is_active: true } };

  const manager = {
    query: jest.fn(async (_sql: string, params: unknown[]) => {
      const found = owners[String(params[0])];
      return found ? [found] : [];
    }),
  };
  const repo = {
    manager,
    create: jest.fn((v) => ({ id: 'r1', createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-02'), deletedAt: null, ...v })),
    save: jest.fn(async (v) => v),
    findOne: jest.fn(async () => row),
    find: jest.fn(),
  };
  const usersRepo = {
    findOne: jest.fn(async () => ({ id: OWNER_ID, roles: [{ name: 'SUPER_ADMIN' }], userPermissions: [] })),
  };
  const notifications = { create: jest.fn(async () => ({})) };
  const service = new RisksService(repo as any, usersRepo as any, notifications as any);
  const warn = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  return { service, repo, row, manager, usersRepo, notifications, logError: warn };
}

const stored = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  ...valid,
  owner: 'Paulo Ossa',
  riskValue: 48,
  residualRisk: 14.4,
  reportedAt: '2026-09-07',
  mitigationStrategy: null,
  actions: null,
  estimatedResolutionDate: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-02'),
  deletedAt: null,
  ...over,
});

describe('RisksService (CRUD)', () => {
  it('create calcula valor y residual en el servidor, copia el nombre del dueño y registra el autor', async () => {
    const { service, repo } = buildService();
    const res = await service.create(valid as any, actor);
    expect(res).toMatchObject({ riskValue: 48, residualRisk: 14.4, level: 'verde', owner: 'Paulo Ossa', ownerUserId: OWNER_ID });
    expect(repo.save.mock.calls[0]?.[0]).toMatchObject({ ownerUserId: OWNER_ID, owner: 'Paulo Ossa', createdBy: 'u1' });
  });

  it('create usa la fecha de hoy si no viene reportedAt', async () => {
    const { service } = buildService();
    expect((await service.create(valid as any, actor)).reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('update recalcula con los valores resultantes', async () => {
    const { service } = buildService({ existing: stored() });
    const res = await service.update('r1', { probabilityScore: 5, controlEfficacy: 0.5 } as any, actor);
    expect(res).toMatchObject({ riskValue: 80, residualRisk: 40, level: 'amarillo' });
  });

  it('update convierte texto vacío de los opcionales en null', async () => {
    const { service } = buildService({ existing: stored({ actions: 'algo' }) });
    expect((await service.update('r1', { actions: '  ' } as any, actor)).actions).toBeNull();
  });

  it('eliminar es baja lógica: marca deletedAt y no borra', async () => {
    const { service, repo, row } = buildService({ existing: stored() });
    expect(await service.remove('r1', actor)).toEqual({ deleted: true });
    expect((row as any).deletedAt).toBeInstanceOf(Date);
    expect((row as any).deletedBy).toBe('u1');
    expect(repo.save).toHaveBeenCalled();
    expect((repo as any).delete).toBeUndefined();
  });

  it('un riesgo dado de baja no se encuentra', async () => {
    const { service, repo } = buildService();
    repo.findOne.mockResolvedValue(undefined as any);
    await expect(service.get('r1')).rejects.toThrow('Riesgo no encontrado');
  });

  it('list consulta solo los activos y devuelve la última actualización', async () => {
    const { service, repo } = buildService();
    repo.find.mockResolvedValue([
      stored({ updatedAt: new Date('2026-10-05T00:00:00Z') }),
      stored({ id: 'r2', updatedAt: new Date('2026-10-09T00:00:00Z') }),
    ]);
    const res = await service.list();
    expect((repo.find.mock.calls[0] as any)[0].where.deletedAt).toBeDefined();
    expect(res.lastUpdate).toBe('2026-10-09T00:00:00.000Z');
    expect(res.data).toHaveLength(2);
  });

  it('list sin riesgos devuelve lastUpdate null', async () => {
    const { service, repo } = buildService();
    repo.find.mockResolvedValue([]);
    expect((await service.list()).lastUpdate).toBeNull();
  });
});

describe('Dueño: validación', () => {
  it('rechaza un dueño inexistente al crear', async () => {
    const { service, repo } = buildService({ owners: {} });
    await expect(service.create(valid as any, actor)).rejects.toThrow('no existe');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza un dueño inactivo al crear', async () => {
    const { service, repo } = buildService({ owners: { [OWNER_ID]: { id: OWNER_ID, name: 'X', is_active: false } } });
    await expect(service.create(valid as any, actor)).rejects.toThrow('inactivo');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza un dueño inactivo al cambiarlo', async () => {
    const { service } = buildService({
      existing: stored(),
      owners: { [OTHER_OWNER_ID]: { id: OTHER_OWNER_ID, name: 'Baja', is_active: false } },
    });
    await expect(service.update('r1', { ownerUserId: OTHER_OWNER_ID } as any, actor)).rejects.toThrow('inactivo');
  });

  it('conservar al dueño actual no se valida: sigue funcionando aunque hoy esté inactivo', async () => {
    const { service, manager } = buildService({
      existing: stored(),
      owners: { [OWNER_ID]: { id: OWNER_ID, name: 'Paulo Ossa', is_active: false } },
    });
    await expect(service.update('r1', { ownerUserId: OWNER_ID, actions: 'x' } as any, actor)).resolves.toBeDefined();
    expect(manager.query).not.toHaveBeenCalled();
  });
});

describe('Dueño: notificación', () => {
  it('al crear notifica al dueño (informativa con residual verde) con enlace si puede abrir la matriz', async () => {
    const { service, notifications } = buildService();
    await service.create(valid as any, actor);
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect((notifications.create.mock.calls[0] as any)[0]).toMatchObject({
      recipientId: OWNER_ID,
      senderId: 'u1',
      type: 'informativa',
      module: 'sgsi',
      entityType: 'risk',
      actionUrl: '/sgsi/matriz-riesgos',
    });
  });

  it('usa el tipo "atencion" cuando el riesgo residual es rojo (> 40)', async () => {
    const { service, notifications } = buildService();
    await service.create({ ...valid, vulnerabilityScore: 5, severityScore: 5, probabilityScore: 5, controlEfficacy: 0.5 } as any, actor);
    expect((notifications.create.mock.calls[0] as any)[0].type).toBe('atencion');
    expect((notifications.create.mock.calls[0] as any)[0].message).toContain('62.5 (Rojo)');
  });

  it('sin permiso de lectura el destinatario recibe la notificación sin enlace', async () => {
    const { service, notifications, usersRepo } = buildService();
    usersRepo.findOne.mockResolvedValue({ id: OWNER_ID, roles: [], userPermissions: [] } as any);
    await service.create(valid as any, actor);
    expect((notifications.create.mock.calls[0] as any)[0]).not.toHaveProperty('actionUrl');
  });

  it('con el permiso sgsi.riesgos.read por rol también lleva enlace', async () => {
    const { service, notifications, usersRepo } = buildService();
    usersRepo.findOne.mockResolvedValue({
      id: OWNER_ID,
      roles: [{ name: 'SGSI', permissions: [{ section: 'sgsi', module: 'riesgos', action: 'read' }] }],
      userPermissions: [],
    } as any);
    await service.create(valid as any, actor);
    expect((notifications.create.mock.calls[0] as any)[0].actionUrl).toBe('/sgsi/matriz-riesgos');
  });

  it('al cambiar el dueño notifica solo al nuevo', async () => {
    const { service, notifications } = buildService({
      existing: stored(),
      owners: { [OTHER_OWNER_ID]: { id: OTHER_OWNER_ID, name: 'Nueva Persona', is_active: true } },
    });
    const res = await service.update('r1', { ownerUserId: OTHER_OWNER_ID } as any, actor);
    expect(res.owner).toBe('Nueva Persona');
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect((notifications.create.mock.calls[0] as any)[0].recipientId).toBe(OTHER_OWNER_ID);
  });

  it('no notifica al editar otros campos', async () => {
    const { service, notifications } = buildService({ existing: stored() });
    await service.update('r1', { actionStatus: 'Resuelto', ownerUserId: OWNER_ID } as any, actor);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('no notifica al eliminar', async () => {
    const { service, notifications } = buildService({ existing: stored() });
    await service.remove('r1', actor);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('no notifica cuando el dueño es quien registra', async () => {
    const { service, notifications } = buildService({
      owners: { u1: { id: 'u1', name: 'Leonardo', is_active: true } },
    });
    await service.create({ ...valid, ownerUserId: 'u1' } as any, actor);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('una falla del servicio de notificaciones no impide guardar y queda en el log', async () => {
    const { service, repo, notifications, logError } = buildService();
    notifications.create.mockRejectedValue(new Error('socket caído'));
    const res = await service.create(valid as any, actor);
    expect(res.id).toBe('r1');
    expect(repo.save).toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('socket caído'));
  });

  it('una falla al cambiar el dueño tampoco impide guardar', async () => {
    const { service, notifications, logError } = buildService({
      existing: stored(),
      owners: { [OTHER_OWNER_ID]: { id: OTHER_OWNER_ID, name: 'Nueva', is_active: true } },
    });
    notifications.create.mockRejectedValue(new Error('boom'));
    await expect(service.update('r1', { ownerUserId: OTHER_OWNER_ID } as any, actor)).resolves.toBeDefined();
    expect(logError).toHaveBeenCalled();
  });
});

describe('Dueño: búsqueda de candidatos', () => {
  const sqlOf = (m: jest.Mock) => String(m.mock.calls[0]?.[0]);
  const paramsOf = (m: jest.Mock) => m.mock.calls[0]?.[1] as unknown[];

  it('con menos de 2 caracteres no consulta', async () => {
    const { service, manager } = buildService();
    expect(await service.searchOwnerCandidates('a')).toEqual([]);
    expect(await service.searchOwnerCandidates('  ')).toEqual([]);
    expect(await service.searchOwnerCandidates(undefined)).toEqual([]);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('busca sin acentos ni mayúsculas, por cada palabra', async () => {
    const { service, manager } = buildService();
    await service.searchOwnerCandidates('Claudia  Vázquez');
    const params = paramsOf(manager.query);
    expect(params).toContain('%claudia%');
    expect(params).toContain('%vazquez%');
    expect(sqlOf(manager.query)).toContain('translate(lower(');
  });

  it('solo usuarios activos y máximo 10 resultados', async () => {
    const { service, manager } = buildService();
    await service.searchOwnerCandidates('paulo');
    expect(sqlOf(manager.query)).toContain('u.is_active = true');
    expect(sqlOf(manager.query)).toContain('u.deleted_at IS NULL');
    expect(paramsOf(manager.query).at(-1)).toBe(10);
  });

  it('escapa los comodines de LIKE', async () => {
    const { service, manager } = buildService();
    await service.searchOwnerCandidates('50%_x');
    expect(paramsOf(manager.query)).toContain('%50\\%\\_x%');
  });

  it('devuelve solo id, nombre y correo', async () => {
    const { service, manager } = buildService();
    manager.query.mockResolvedValue([
      { id: OWNER_ID, name: 'Paulo Ossa', email: 'p@l.com', salary: 999, is_active: true },
    ] as any);
    expect(await service.searchOwnerCandidates('paulo')).toEqual([
      { id: OWNER_ID, name: 'Paulo Ossa', email: 'p@l.com' },
    ]);
  });
});

describe('Permisos de las rutas', () => {
  const required = (method: keyof RisksController) =>
    Reflect.getMetadata(PERMISSION_KEY, RisksController.prototype[method]);

  it.each(['list', 'get'] as const)('%s exige sgsi.riesgos.read', (m) => {
    expect(required(m)).toEqual({ section: 'sgsi', module: 'riesgos', action: 'read' });
  });

  it.each(['create', 'update', 'remove', 'ownerCandidates'] as const)('%s exige sgsi.riesgos.write', (m) => {
    expect(required(m)).toEqual({ section: 'sgsi', module: 'riesgos', action: 'write' });
  });
});
