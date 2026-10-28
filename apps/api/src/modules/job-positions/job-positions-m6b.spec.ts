import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateKpiDto, CreateOkrDto, ImportBodyDto, UpdateOkrDto, UpdatePositionDto } from './dto/job-position.dto';
import { JobPositionItemsService } from './job-position-items.service';
import { JobPositionsService } from './job-positions.service';
import { applyValidationChange, buildPositionWhere, normalizeOkrPeriod } from './job-positions.util';

const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };
const NOW = new Date('2026-03-01T10:00:00Z');

describe('Matriz de Puestos (M6-B) · estado de validación', () => {
  const pending = { status: 'pendiente' as const, by: null, at: null };
  it('cualquier valor distinto de pendiente guarda quién y cuándo (de la sesión)', () => {
    expect(applyValidationChange(pending, 'validado', 'u1', NOW)).toEqual({ status: 'validado', by: 'u1', at: NOW });
    expect(applyValidationChange(pending, 'validado_con_ajustes', 'u1', NOW).status).toBe('validado_con_ajustes');
    expect(applyValidationChange(pending, 'rechazado', 'u1', NOW).by).toBe('u1');
  });
  it('volver a pendiente limpia quién y cuándo', () => {
    expect(applyValidationChange({ status: 'validado', by: 'u1', at: NOW }, 'pendiente', 'u2', NOW)).toEqual(pending);
  });
  it('sin cambio de estado conserva quién y cuándo; sin valor, no toca nada', () => {
    const cur = { status: 'validado' as const, by: 'u1', at: NOW };
    expect(applyValidationChange(cur, 'validado', 'u2', new Date())).toBe(cur);
    expect(applyValidationChange(cur, undefined, 'u2', new Date())).toBe(cur);
  });
  it('pasar de un estado validado a otro registra a quien lo cambió', () => {
    expect(applyValidationChange({ status: 'validado', by: 'u1', at: NOW }, 'rechazado', 'u2', NOW)).toEqual({ status: 'rechazado', by: 'u2', at: NOW });
  });
});

describe('Matriz de Puestos (M6-B) · periodo de plantilla y filtros', () => {
  it('vacío, null y «base» son plantilla (NULL); un semestre válido se conserva; undefined = sin cambio', () => {
    expect(normalizeOkrPeriod(undefined)).toBeUndefined();
    expect(normalizeOkrPeriod(null)).toBeNull();
    expect(normalizeOkrPeriod('')).toBeNull();
    expect(normalizeOkrPeriod(' base ')).toBeNull();
    expect(normalizeOkrPeriod('2026-S1')).toBe('2026-S1');
    expect(() => normalizeOkrPeriod('2026-S3')).toThrow();
  });
  it('filtros de división y estado de validación como parámetros', () => {
    const { where, params } = buildPositionWhere({ division: 'E-Commerce', validationStatus: 'validado' });
    expect(where).toContain('p.division = $1');
    expect(where).toContain('p.validation_status = $2');
    expect(params).toEqual(['E-Commerce', 'validado']);
  });
});

/** Base falsa mínima: responde por expresión regular y registra cada consulta. */
function fakeDb(answer: (sql: string, params: unknown[]) => unknown) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (rawSql: string, params: unknown[] = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    calls.push({ sql, params });
    return answer(sql, params) ?? [];
  });
  const db = { query, transaction: async (cb: (m: unknown) => Promise<unknown>) => cb(db) };
  return { db, calls };
}

describe('Matriz de Puestos (M6-B) · OKRs de plantilla', () => {
  const okrRow = (over: Record<string, unknown> = {}) => ({
    id: 'o1', job_position_id: 'p1', period: null, objective_code: 'O1', kr_code: 'KR1', objective: 'Obj', key_result: 'KR', weight: null, sort_order: 0, is_active: true, ...over,
  });
  const build = (others: unknown[] = []) => {
    const { db, calls } = fakeDb((sql) => {
      if (/FROM hr\.job_positions WHERE id/.test(sql)) return [{ id: 'p1', code: 'JP-001', title: 'TEST' }];
      if (/^SELECT weight FROM/.test(sql)) return others;
      if (/^INSERT INTO hr\.job_position_okrs/.test(sql)) return [okrRow()];
      if (/^INSERT INTO hr\.job_position_kpis/.test(sql)) return [{ id: 'k1', job_position_id: 'p1', name: 'K', description: null, target_value: null, measurement_frequency: null, is_active: true }];
      return [];
    });
    const audit = { logActivity: jest.fn() };
    return { service: new JobPositionItemsService(db as never, audit as never), calls, audit };
  };

  it('alta sin periodo: queda NULL (plantilla) con códigos, y los pesos se validan en su propio grupo', async () => {
    const { service, calls, audit } = build();
    const okr = await service.createOkr('p1', { objective: 'Obj', keyResult: 'KR', objectiveCode: 'O1', krCode: 'KR1' }, ACTOR);
    expect(okr).toMatchObject({ period: null, objectiveCode: 'O1', krCode: 'KR1', weight: null });
    const weights = calls.find((c) => /^SELECT weight/.test(c.sql))!;
    expect(weights.sql).toContain('period IS NOT DISTINCT FROM $2');
    expect(weights.params[1]).toBeNull();
    const insert = calls.find((c) => /^INSERT INTO hr\.job_position_okrs/.test(c.sql))!;
    expect(insert.params.slice(0, 4)).toEqual(['p1', null, 'O1', 'KR1']);
    expect(audit.logActivity.mock.calls[0]![0].entityName).toBe('JP-001 · Plantilla');
  });

  it('«base» también es plantilla; la suma de pesos de la plantilla no pasa de 100', async () => {
    const { service } = build([{ weight: '70' }]);
    await expect(service.createOkr('p1', { period: 'base', objective: 'O', keyResult: 'K', weight: 40 }, ACTOR)).rejects.toThrow(/no puede pasar de 100/);
  });

  it('listar «base» pide solo la plantilla; sin parámetro, todos', async () => {
    const { service, calls } = build();
    await service.listOkrs('p1', 'base');
    await service.listOkrs('p1');
    const lists = calls.filter((c) => /^SELECT .* FROM hr\.job_position_okrs/.test(c.sql));
    expect(lists[0]!.params[1]).toBe('base');
    expect(lists[0]!.sql).toContain("($2 = 'base' AND period IS NULL)");
    expect(lists[1]!.params[1]).toBeNull();
  });

  it('un KPI con frecuencia semanal o diaria es válido', async () => {
    const { service } = build();
    await expect(service.createKpi('p1', { name: 'K', measurementFrequency: 'semanal' }, ACTOR)).resolves.toBeDefined();
    await expect(service.createKpi('p1', { name: 'K', measurementFrequency: 'diario' }, ACTOR)).resolves.toBeDefined();
    await expect(service.createKpi('p1', { name: 'K', measurementFrequency: 'bimestral' }, ACTOR)).rejects.toThrow();
  });
});

describe('Matriz de Puestos (M6-B) · editar el puesto (validación y campos nuevos)', () => {
  const base = {
    id: 'p1', code: 'JP-001', title: 'TEST-Analista', area: 'TI', business_unit: 'TEST-UN', level: 'II', description: null, description_approved: false,
    description_approved_by: null, description_approved_at: null, status: 'activo', division: 'E-Commerce', meot_hierarchy: null, reports_to_text: null,
    supervises_text: null, plazas: 2, role_summary: 'Rol', position_objective: null, validation_points: null, head_comments: null,
    validation_status: 'pendiente', validated_by: null, validator_name: null, validated_at: null, created_at: new Date(), updated_at: new Date(),
  };
  const build = (cur: Record<string, unknown> = base) => {
    const { db, calls } = fakeDb((sql) => {
      if (/FOR UPDATE/.test(sql)) return [cur];
      if (/^SELECT p\.\*/.test(sql)) return [cur];
      return [];
    });
    const audit = { logActivity: jest.fn() };
    return { service: new JobPositionsService(db as never, audit as never), calls, audit };
  };

  it('validar guarda quién y cuándo (de la sesión) y deja auditoría; el comentario del Head va como «modificado»', async () => {
    const { service, calls, audit } = build();
    await service.update('p1', { validationStatus: 'validado', headComments: 'Texto largo del Head' }, ACTOR);
    const update = calls.find((c) => /^UPDATE hr\.job_positions SET/.test(c.sql))!;
    expect(update.params[19]).toBe('validado');
    expect(update.params[20]).toBe('user-1');
    expect(update.params[21]).toBeInstanceOf(Date);
    expect(update.params[18]).toBe('Texto largo del Head');
    const changes = audit.logActivity.mock.calls[0]![0].changes;
    expect(changes.validationStatus).toEqual({ from: 'pendiente', to: 'validado' });
    expect(changes.headComments).toEqual({ from: 'modificado', to: 'modificado' });
    expect(JSON.stringify(changes)).not.toContain('Texto largo del Head');
  });

  it('volver a pendiente limpia quién y cuándo', async () => {
    const { service, calls } = build({ ...base, validation_status: 'validado', validated_by: 'u0', validated_at: new Date() });
    await service.update('p1', { validationStatus: 'pendiente' }, ACTOR);
    const update = calls.find((c) => /^UPDATE hr\.job_positions SET/.test(c.sql))!;
    expect(update.params.slice(19, 22)).toEqual(['pendiente', null, null]);
  });

  it('un cambio que no toca la validación la conserva tal cual (incluido quién validó)', async () => {
    const at = new Date('2026-01-01');
    const { service, calls } = build({ ...base, validation_status: 'validado', validated_by: 'u0', validated_at: at });
    await service.update('p1', { plazas: 0 }, ACTOR);
    const update = calls.find((c) => /^UPDATE hr\.job_positions SET/.test(c.sql))!;
    expect(update.params[14]).toBe(0);
    expect(update.params.slice(19, 22)).toEqual(['validado', 'u0', at]);
  });

  it('la unidad de negocio sigue aceptándose en el API y se conserva si no se manda', async () => {
    const { service, calls } = build();
    await service.update('p1', { plazas: 3 }, ACTOR);
    expect(calls.find((c) => /^UPDATE hr\.job_positions SET/.test(c.sql))!.params[3]).toBe('TEST-UN');
  });
});

describe('Matriz de Puestos (M6-B) · validación de los DTO', () => {
  const errs = async (cls: new () => object, plain: object) => (await validate(plainToInstance(cls, plain))).map((e) => e.property);

  it('OKR: periodo vacío o «base» es plantilla; formato inválido o códigos largos se rechazan', async () => {
    expect(await errs(CreateOkrDto, { objective: 'O', keyResult: 'K' })).toEqual([]);
    expect(await errs(CreateOkrDto, { period: '', objective: 'O', keyResult: 'K' })).toEqual([]);
    expect(await errs(CreateOkrDto, { period: 'base', objective: 'O', keyResult: 'K', objectiveCode: 'O1', krCode: 'KR1' })).toEqual([]);
    expect(await errs(CreateOkrDto, { period: '2026-S3', objective: 'O', keyResult: 'K' })).toEqual(['period']);
    expect(await errs(CreateOkrDto, { objective: 'O', keyResult: 'K', objectiveCode: 'x'.repeat(11) })).toEqual(['objectiveCode']);
    expect(await errs(UpdateOkrDto, { period: 'base' })).toEqual([]);
  });
  it('KPI: frecuencias nuevas válidas', async () => {
    for (const f of ['diario', 'semanal', 'quincenal', 'mensual']) expect(await errs(CreateKpiDto, { name: 'K', measurementFrequency: f })).toEqual([]);
    expect(await errs(CreateKpiDto, { name: 'K', measurementFrequency: 'bimestral' })).toEqual(['measurementFrequency']);
  });
  it('puesto: estatus de validación y plazas', async () => {
    expect(await errs(UpdatePositionDto, { validationStatus: 'validado_con_ajustes', plazas: 0 })).toEqual([]);
    expect(await errs(UpdatePositionDto, { validationStatus: 'quizá' })).toEqual(['validationStatus']);
    expect(await errs(UpdatePositionDto, { plazas: -1 })).toEqual(['plazas']);
  });
  it('importación: modo y división obligatorios', async () => {
    expect(await errs(ImportBodyDto, { mode: 'preview', division: 'E-Commerce' })).toEqual([]);
    expect((await errs(ImportBodyDto, { mode: 'otro', division: '' })).sort()).toEqual(['division', 'mode']);
  });
});
