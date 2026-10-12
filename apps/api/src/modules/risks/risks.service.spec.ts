import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreateRiskDto, UpdateRiskDto } from './dto/risk.dto';
import { RisksController } from './risks.controller';
import { RisksService } from './risks.service';

const user = { id: 'u1' } as any;

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
  owner: 'Paulo Ossa',
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

  it.each(['category', 'threat', 'vulnerability', 'affectedAsset', 'risk', 'control', 'owner'])(
    'rechaza %s vacío',
    async (campo) => {
      await expect(validate({ ...valid, [campo]: '   ' })).rejects.toThrow(BadRequestException);
    },
  );

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
    await expect(validate({ owner: 'Otra persona' }, UpdateRiskDto)).resolves.toBeDefined();
    await expect(validate({ severityScore: 9 }, UpdateRiskDto)).rejects.toThrow(BadRequestException);
  });
});

function buildService(existing?: Record<string, unknown>) {
  const row = existing ? { ...existing } : undefined;
  const repo = {
    create: jest.fn((v) => ({ id: 'r1', createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-02'), deletedAt: null, ...v })),
    save: jest.fn(async (v) => v),
    findOne: jest.fn(async () => row),
    find: jest.fn(),
  };
  return { service: new RisksService(repo as any), repo, row };
}

const stored = () => ({
  id: 'r1',
  ...valid,
  riskValue: 48,
  residualRisk: 14.4,
  reportedAt: '2026-09-07',
  mitigationStrategy: null,
  actions: null,
  estimatedResolutionDate: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-02'),
  deletedAt: null,
});

describe('RisksService', () => {
  it('create calcula valor y residual en el servidor y registra el autor', async () => {
    const { service, repo } = buildService();
    const res = await service.create(valid as any, user);
    expect(res).toMatchObject({ riskValue: 48, residualRisk: 14.4, level: 'verde' });
    expect(repo.save.mock.calls[0]?.[0]).toMatchObject({ riskValue: 48, residualRisk: 14.4, createdBy: 'u1' });
  });

  it('create usa la fecha de hoy si no viene reportedAt', async () => {
    const { service } = buildService();
    const res = await service.create(valid as any, user);
    expect(res.reportedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('update recalcula con los valores resultantes', async () => {
    const { service } = buildService(stored());
    const res = await service.update('r1', { probabilityScore: 5, controlEfficacy: 0.5 } as any, user);
    expect(res).toMatchObject({ riskValue: 80, residualRisk: 40, level: 'amarillo' });
  });

  it('update convierte texto vacío de los opcionales en null', async () => {
    const { service } = buildService({ ...stored(), actions: 'algo' });
    const res = await service.update('r1', { actions: '  ' } as any, user);
    expect(res.actions).toBeNull();
  });

  it('eliminar es baja lógica: marca deletedAt y no borra', async () => {
    const { service, repo, row } = buildService(stored());
    const res = await service.remove('r1', user);
    expect(res).toEqual({ deleted: true });
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
      { ...stored(), updatedAt: new Date('2026-10-05T00:00:00Z') },
      { ...stored(), id: 'r2', updatedAt: new Date('2026-10-09T00:00:00Z') },
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

describe('Permisos de las rutas', () => {
  const required = (method: keyof RisksController) =>
    Reflect.getMetadata(PERMISSION_KEY, RisksController.prototype[method]);

  it.each(['list', 'get'] as const)('%s exige sgsi.riesgos.read', (m) => {
    expect(required(m)).toEqual({ section: 'sgsi', module: 'riesgos', action: 'read' });
  });

  it.each(['create', 'update', 'remove'] as const)('%s exige sgsi.riesgos.write', (m) => {
    expect(required(m)).toEqual({ section: 'sgsi', module: 'riesgos', action: 'write' });
  });
});
