import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { CreateKpiDto, CreateOkrDto, CreatePositionDto, PositionQueryDto, UpdateOkrDto } from './dto/job-position.dto';
import { JobPositionItemsService } from './job-position-items.service';
import { JobPositionsController } from './job-positions.controller';
import { JobPositionsService } from './job-positions.service';
import {
  applyDescriptionChange,
  assertCanApprove,
  assertFrequency,
  assertPeriod,
  assertWeightSum,
  buildPositionWhere,
  escapeLike,
  formatPositionCode,
  nextPositionCode,
  resolveStatus,
  statusAfterApproval,
  sumWeights,
  toDetail,
  toListItem,
  type DescriptionState,
  type PositionRow,
} from './job-positions.util';

const ACTOR = { id: 'user-1', email: 'rrhh@lievant.com', name: 'RRHH' };
const P1 = '11111111-1111-4111-8111-111111111111';
const OKR1 = '22222222-2222-4222-8222-222222222222';

// ── Lógica pura ──────────────────────────────────────────────────────────────

describe('Matriz de Puestos · código consecutivo', () => {
  it('formato con relleno a 3 dígitos y más si crece', () => {
    expect(formatPositionCode(1)).toBe('JP-001');
    expect(formatPositionCode(99)).toBe('JP-099');
    expect(formatPositionCode(1000)).toBe('JP-1000');
  });
  it('arranca en JP-001 y continúa tras el máximo', () => {
    expect(nextPositionCode([])).toBe('JP-001');
    expect(nextPositionCode(['JP-001', 'JP-002', 'JP-010'])).toBe('JP-011');
  });
  it('no reutiliza códigos de eliminados: se calcula sobre todos los existentes', () => {
    // JP-003 pertenece a un puesto eliminado pero sigue contando.
    expect(nextPositionCode(['JP-001', 'JP-002', 'JP-003'])).toBe('JP-004');
  });
  it('ignora códigos ajenos al formato', () => {
    expect(nextPositionCode(['X-9', 'JP-abc', 'JP-005'])).toBe('JP-006');
  });
});

describe('Matriz de Puestos · descripción y estado', () => {
  const base: DescriptionState = { description: 'Texto', approved: true, approvedBy: 'u', approvedAt: new Date() };

  it('cambiar el texto invalida la aprobación y borra quién y cuándo', () => {
    const next = applyDescriptionChange(base, 'Texto nuevo');
    expect(next).toEqual({ description: 'Texto nuevo', approved: false, approvedBy: null, approvedAt: null });
  });
  it('el mismo texto (aunque con espacios) conserva la aprobación', () => {
    expect(applyDescriptionChange(base, '  Texto  ')).toBe(base);
  });
  it('no mandar descripción (editar otros campos) conserva la aprobación', () => {
    expect(applyDescriptionChange(base, undefined)).toBe(base);
  });
  it('vaciar la descripción la invalida y queda null', () => {
    expect(applyDescriptionChange(base, '   ')).toMatchObject({ description: null, approved: false });
  });

  it('transición automática: descripción sin aprobar → pendiente; aprobada o vacía → activo; inactivo se respeta', () => {
    expect(resolveStatus('activo', { description: 'x', approved: false })).toBe('pendiente_aprobacion');
    expect(resolveStatus('pendiente_aprobacion', { description: 'x', approved: false })).toBe('pendiente_aprobacion');
    expect(resolveStatus('activo', { description: 'x', approved: true })).toBe('activo');
    expect(resolveStatus('activo', { description: null, approved: false })).toBe('activo');
    expect(resolveStatus('inactivo', { description: 'x', approved: false })).toBe('inactivo');
  });

  it('aprobar exige descripción no vacía y que no esté ya aprobada', () => {
    expect(() => assertCanApprove({ description: null, approved: false })).toThrow(/no tiene descripción/);
    expect(() => assertCanApprove({ description: 'x', approved: true })).toThrow(/ya está aprobada/);
    expect(() => assertCanApprove({ description: 'x', approved: false })).not.toThrow();
  });
  it('tras aprobar: pendiente → activo; inactivo se queda', () => {
    expect(statusAfterApproval('pendiente_aprobacion')).toBe('activo');
    expect(statusAfterApproval('inactivo')).toBe('inactivo');
  });
});

describe('Matriz de Puestos · periodo, frecuencia y pesos', () => {
  it('periodo AAAA-S1 / AAAA-S2', () => {
    expect(() => assertPeriod('2026-S1')).not.toThrow();
    expect(() => assertPeriod('2026-S2')).not.toThrow();
    for (const bad of ['2026-S3', '2026-S0', '26-S1', '2026S1', '2026-s1', '2026-Q1', '']) {
      expect(() => assertPeriod(bad)).toThrow(BadRequestException);
    }
  });
  it('frecuencia válida o nula', () => {
    for (const ok of ['diario', 'semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual', null, undefined]) expect(() => assertFrequency(ok)).not.toThrow();
    expect(() => assertFrequency('bimestral')).toThrow(BadRequestException);
  });
  it('la suma de pesos no arrastra errores de coma flotante', () => {
    expect(sumWeights([0.1, 0.2])).toBe(0.3);
    expect(sumWeights([33.33, 33.33, 33.34])).toBe(100);
    expect(sumWeights([null, 40])).toBe(40);
  });
  it('justo 100 se acepta; 100.01 se rechaza con mensaje claro', () => {
    expect(() => assertWeightSum([60, 30], 10, true)).not.toThrow();
    expect(() => assertWeightSum([60, 30], 10.01, true)).toThrow(/no puede pasar de 100/);
  });
  it('un OKR inactivo o sin peso no cuenta', () => {
    expect(() => assertWeightSum([90], 50, false)).not.toThrow();
    expect(() => assertWeightSum([90], null, true)).not.toThrow();
  });
});

describe('Matriz de Puestos · filtros del listado', () => {
  it('siempre excluye eliminados', () => {
    expect(buildPositionWhere({}).where).toBe('p.deleted_at IS NULL');
  });
  it('área, unidad, nivel y estado como parámetros', () => {
    const { where, params } = buildPositionWhere({ area: 'TI', businessUnit: 'Norte', level: 'Senior', status: 'activo' });
    expect(where).toContain('p.area = $1');
    expect(where).toContain('p.business_unit = $2');
    expect(where).toContain('p.level = $3');
    expect(where).toContain('p.status = $4');
    expect(params).toEqual(['TI', 'Norte', 'Senior', 'activo']);
  });
  it('búsqueda por código y título, con comodines escapados', () => {
    const { where, params } = buildPositionWhere({ search: ' 50%_ ' });
    expect(where).toContain('p.code ILIKE $1 OR p.title ILIKE $1');
    expect(params).toEqual(['%50\\%\\_%']);
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });
});

const EXTRA = {
  level_original: null, seniority: null, division: null, meot_hierarchy: null, reports_to_text: null, supervises_text: null, plazas: null, role_summary: null,
  position_objective: null, validation_points: null, head_comments: null, validation_status: 'pendiente' as const,
  validated_by: null, validator_name: null, validated_at: null,
};

describe('Matriz de Puestos · vistas', () => {
  const row = (over: Partial<PositionRow> = {}): PositionRow => ({
    id: P1, code: 'JP-001', title: 'Analista', area: 'TI', business_unit: null, level: null,
    description: null, description_approved: false, description_approved_by: null, approver_name: null,
    description_approved_at: null, status: 'activo', ...EXTRA, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-02'), ...over,
  });
  it('lista: sin descripción se marca hasDescription=false', () => {
    expect(toListItem(row()).hasDescription).toBe(false);
    expect(toListItem(row({ description: 'x' })).hasDescription).toBe(true);
  });
  it('detalle: quién aprobó y cuándo, sin ids de auditoría crudos', () => {
    const d = toDetail(row({ description: 'x', description_approved: true, description_approved_by: 'u1', approver_name: 'Claudia', description_approved_at: new Date('2026-03-01T12:00:00Z') }), [], []);
    expect(d.approvedBy).toEqual({ id: 'u1', name: 'Claudia' });
    expect(d.approvedAt).toBe('2026-03-01T12:00:00.000Z');
    expect(JSON.stringify(d)).not.toMatch(/created_by|deleted_at/);
  });
});

// ── DTO ──────────────────────────────────────────────────────────────────────

const errs = async (cls: new () => object, plain: object) => (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe('Matriz de Puestos · DTO', () => {
  it('puesto: título y área obligatorios, longitudes y estado manual', async () => {
    expect(await errs(CreatePositionDto, { title: 'A', area: 'B' })).toEqual([]);
    expect(await errs(CreatePositionDto, { area: 'B' })).toContain('title');
    expect(await errs(CreatePositionDto, { title: 'x'.repeat(201), area: 'B' })).toContain('title');
    expect(await errs(CreatePositionDto, { title: 'A', area: 'B', description: 'x'.repeat(10001) })).toContain('description');
    expect(await errs(CreatePositionDto, { title: 'A', area: 'B', status: 'pendiente_aprobacion' })).toContain('status');
  });
  it('nivel libre (sin lista cerrada)', async () => {
    expect(await errs(CreatePositionDto, { title: 'A', area: 'B', level: 'Cualquier valor del Excel' })).toEqual([]);
  });
  it('OKR: periodo, textos, peso 0–100', async () => {
    const ok = { period: '2026-S1', objective: 'o', keyResult: 'k', weight: 50 };
    expect(await errs(CreateOkrDto, ok)).toEqual([]);
    expect(await errs(CreateOkrDto, { ...ok, period: '2026-S3' })).toContain('period');
    expect(await errs(CreateOkrDto, { ...ok, weight: 101 })).toContain('weight');
    expect(await errs(CreateOkrDto, { ...ok, weight: -1 })).toContain('weight');
    expect(await errs(CreateOkrDto, { ...ok, objective: 'x'.repeat(2001) })).toContain('objective');
    expect(await errs(UpdateOkrDto, { weight: null })).toEqual([]);
  });
  it('KPI: frecuencia válida', async () => {
    expect(await errs(CreateKpiDto, { name: 'k', measurementFrequency: 'mensual' })).toEqual([]);
    expect(await errs(CreateKpiDto, { name: 'k', measurementFrequency: 'diaria' })).toContain('measurementFrequency');
    expect(await errs(CreateKpiDto, { name: 'x'.repeat(201) })).toContain('name');
  });
  it('listado: estado, límite y página acotados', async () => {
    expect(await errs(PositionQueryDto, { status: 'x' })).toContain('status');
    expect(await errs(PositionQueryDto, { limit: 101 })).toContain('limit');
    expect(await errs(PositionQueryDto, { page: 0 })).toContain('page');
  });
});

// ── Servicio con BD simulada ─────────────────────────────────────────────────

interface Call { sql: string; params: unknown[] }

function fakeDb(handler: (sql: string, params: unknown[]) => unknown) {
  const calls: Call[] = [];
  let transactions = 0;
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return handler(sql, params);
  });
  const dataSource = { query, transaction: jest.fn(async (cb: (m: unknown) => unknown) => { transactions++; return cb({ query }); }) };
  return { dataSource, calls, get transactions() { return transactions; } };
}

const posRow = (over: Partial<PositionRow> = {}): PositionRow => ({
  id: P1, code: 'JP-004', title: 'Analista', area: 'TI', business_unit: null, level: null,
  description: null, description_approved: false, description_approved_by: null, approver_name: null,
  description_approved_at: null, status: 'activo', ...EXTRA, created_at: new Date(), updated_at: new Date(), ...over,
});

describe('Matriz de Puestos · servicio de puestos', () => {
  const build = (current: PositionRow, codes: string[] = []) => {
    const db = fakeDb((sql) => {
      if (/SELECT code FROM hr\.job_positions/.test(sql)) return codes.map((code) => ({ code }));
      if (/FROM catalogs\.job_position_levels/.test(sql)) return ['I', 'II', 'III', 'IV'].map((code) => ({ code }));
      if (/FROM catalogs\.areas/.test(sql)) return ['TI', 'B', 'Ventas'].map((name) => ({ name, division_name: null }));
      if (/INSERT INTO hr\.job_positions/.test(sql)) return [{ id: P1 }];
      if (/FROM hr\.job_positions p\s+LEFT JOIN/.test(sql)) return [current];
      if (/FOR UPDATE/.test(sql)) return [current];
      if (/UPDATE hr\.job_positions SET deleted_at/.test(sql)) return [[{ id: P1, code: 'JP-004', title: 'Analista' }], 1];
      if (/FROM hr\.job_position_(okrs|kpis)/.test(sql)) return [];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    return { service: new JobPositionsService(db.dataSource as never, audit as never), db, audit };
  };

  it('alta: código consecutivo calculado bajo candado y sobre todos los códigos (incluidos eliminados)', async () => {
    const { service, db, audit } = build(posRow({ code: 'JP-004' }), ['JP-001', 'JP-002', 'JP-003']);
    const res = await service.create(plainToInstance(CreatePositionDto, { title: ' Analista ', area: 'TI' }), ACTOR);
    expect(db.calls[0]!.sql).toContain('pg_advisory_xact_lock');
    const select = db.calls.find((c) => /SELECT code FROM hr\.job_positions/.test(c.sql))!;
    expect(select.sql).not.toContain('deleted_at');
    const insert = db.calls.find((c) => /INSERT INTO hr\.job_positions/.test(c.sql))!;
    expect(insert.params.slice(0, 3)).toEqual(['JP-004', 'Analista', 'TI']);
    expect(insert.params[7]).toBe('user-1');
    expect(res.code).toBe('JP-004');
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entityType: 'job_position', module: 'matriz-puestos', userId: 'user-1' }));
  });

  it('alta con descripción nace pendiente_aprobacion; sin ella, activo; inactivo se respeta', async () => {
    const withDesc = build(posRow());
    await withDesc.service.create(plainToInstance(CreatePositionDto, { title: 'A', area: 'B', description: 'Texto' }), ACTOR);
    expect(withDesc.db.calls.find((c) => /INSERT/.test(c.sql))!.params[6]).toBe('pendiente_aprobacion');
    const without = build(posRow());
    await without.service.create(plainToInstance(CreatePositionDto, { title: 'A', area: 'B' }), ACTOR);
    expect(without.db.calls.find((c) => /INSERT/.test(c.sql))!.params[6]).toBe('activo');
    const inactive = build(posRow());
    await inactive.service.create(plainToInstance(CreatePositionDto, { title: 'A', area: 'B', description: 'T', status: 'inactivo' }), ACTOR);
    expect(inactive.db.calls.find((c) => /INSERT/.test(c.sql))!.params[6]).toBe('inactivo');
  });

  const updateParams = (db: ReturnType<typeof fakeDb>) => db.calls.find((c) => /UPDATE hr\.job_positions SET title/.test(c.sql))!.params;

  it('editar el texto de una descripción aprobada invalida la aprobación y regresa a pendiente', async () => {
    const approved = posRow({ description: 'Original', description_approved: true, description_approved_by: 'u9', description_approved_at: new Date(), status: 'activo' });
    const { service, db, audit } = build(approved);
    await service.update(P1, { description: 'Cambiada' }, ACTOR);
    const p = updateParams(db);
    expect(p[5]).toBe('Cambiada');
    expect(p.slice(6, 9)).toEqual([false, null, null]);
    expect(p[9]).toBe('pendiente_aprobacion');
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'update', changes: expect.objectContaining({ descriptionApproved: { from: true, to: false } }) }));
  });

  it('editar otro campo NO invalida la aprobación', async () => {
    const stamp = new Date('2026-02-02');
    const approved = posRow({ description: 'Original', description_approved: true, description_approved_by: 'u9', description_approved_at: stamp, status: 'activo' });
    const { service, db } = build(approved);
    await service.update(P1, { title: 'Nuevo título', area: 'Ventas' }, ACTOR);
    const p = updateParams(db);
    expect(p.slice(1, 3)).toEqual(['Nuevo título', 'Ventas']);
    expect(p.slice(6, 9)).toEqual([true, 'u9', stamp]);
    expect(p[9]).toBe('activo');
  });

  it('un puesto inactivo con descripción editada se queda inactivo', async () => {
    const { service, db } = build(posRow({ description: 'A', status: 'inactivo' }));
    await service.update(P1, { description: 'B' }, ACTOR);
    expect(updateParams(db)[9]).toBe('inactivo');
  });

  it('aprobar guarda quién (de la sesión) y cuándo, y pasa a activo; sin descripción se rechaza', async () => {
    const pending = posRow({ description: 'Texto', status: 'pendiente_aprobacion' });
    const ok = build(pending);
    await ok.service.approveDescription(P1, ACTOR);
    const up = ok.db.calls.find((c) => /UPDATE hr\.job_positions SET description_approved = true/.test(c.sql))!;
    expect(up.sql).toContain('description_approved_at = NOW()');
    expect(up.params).toEqual([P1, 'user-1', 'activo']);
    expect(ok.audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve' }));

    const empty = build(posRow({ description: null }));
    await expect(empty.service.approveDescription(P1, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(empty.audit.logActivity).not.toHaveBeenCalled();
  });

  it('eliminar: soft delete en cascada (puesto, OKRs y KPIs) dentro de UNA transacción y con auditoría', async () => {
    const { service, db, audit } = build(posRow());
    await service.remove(P1, ACTOR);
    expect(db.transactions).toBe(1);
    const sqls = db.calls.map((c) => c.sql);
    expect(sqls.some((s) => /UPDATE hr\.job_positions SET deleted_at = NOW\(\)/.test(s))).toBe(true);
    expect(sqls.some((s) => /UPDATE hr\.job_position_okrs SET deleted_at = NOW\(\)/.test(s))).toBe(true);
    expect(sqls.some((s) => /UPDATE hr\.job_position_kpis SET deleted_at = NOW\(\)/.test(s))).toBe(true);
    expect(sqls.some((s) => /DELETE FROM/.test(s))).toBe(false);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', entityType: 'job_position' }));
  });

  it('eliminar un puesto inexistente o ya eliminado: 404 y no toca OKRs', async () => {
    const db = fakeDb((sql) => (/UPDATE hr\.job_positions SET deleted_at/.test(sql) ? [[], 0] : []));
    const service = new JobPositionsService(db.dataSource as never, { logActivity: jest.fn() } as never);
    await expect(service.remove(P1, ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.calls.some((c) => /job_position_okrs/.test(c.sql))).toBe(false);
  });

  it('listado: una consulta con total, orden numérico por código y paginación', async () => {
    const db = fakeDb(() => [{ ...posRow(), total_count: 53 }]);
    const service = new JobPositionsService(db.dataSource as never, { logActivity: jest.fn() } as never);
    const res = await service.list(plainToInstance(PositionQueryDto, { page: 2, limit: 10, area: 'TI' }));
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]!.sql).toContain('COUNT(*) OVER()');
    expect(db.calls[0]!.sql).toContain('ORDER BY length(p.code) ASC, p.code ASC');
    expect(db.calls[0]!.sql).toContain('p.deleted_at IS NULL');
    expect(db.calls[0]!.params).toEqual(['TI', 10, 10]);
    expect(res).toMatchObject({ total: 53, page: 2, totalPages: 6 });
  });

  it('el detalle trae el nombre de quien aprobó con un JOIN (sin consultas por persona)', async () => {
    const db = fakeDb((sql) => (/job_positions p\s+LEFT JOIN auth\.users/.test(sql) ? [posRow({ description: 'x', description_approved: true, description_approved_by: 'u1', approver_name: 'Claudia' })] : []));
    const service = new JobPositionsService(db.dataSource as never, { logActivity: jest.fn() } as never);
    const d = await service.getDetail(P1);
    expect(d.approvedBy?.name).toBe('Claudia');
    expect(db.calls.filter((c) => /auth\.users/.test(c.sql))).toHaveLength(1);
    expect(db.calls.every((c) => /deleted_at IS NULL/.test(c.sql))).toBe(true);
  });
});

describe('Matriz de Puestos · OKRs y KPIs', () => {
  const okrRow = (weight: number | null, over: object = {}) => ({
    id: OKR1, job_position_id: P1, period: '2026-S1', objective: 'o', key_result: 'k', weight, sort_order: 0, is_active: true, ...over,
  });
  const build = (others: number[], existing: ReturnType<typeof okrRow> | null = null) => {
    const db = fakeDb((sql, params) => {
      if (/FROM hr\.job_positions WHERE id = \$1 AND deleted_at IS NULL FOR UPDATE/.test(sql)) return [{ id: P1, code: 'JP-001', title: 'Analista' }];
      if (/SELECT weight FROM hr\.job_position_okrs/.test(sql)) return others.map((w) => ({ weight: String(w) }));
      if (/INSERT INTO hr\.job_position_okrs/.test(sql)) return [okrRow(params[4] as number | null)];
      if (/SELECT .* FROM hr\.job_position_okrs WHERE id/.test(sql)) return existing ? [existing] : [];
      if (/UPDATE hr\.job_position_okrs SET period/.test(sql)) return [[okrRow(40)], 1];
      if (/UPDATE hr\.job_position_okrs SET deleted_at/.test(sql)) return [[{ id: OKR1, period: '2026-S1', job_position_id: P1 }], 1];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    return { service: new JobPositionItemsService(db.dataSource as never, audit as never), db, audit };
  };
  const okrDto = (weight: number | null, over: object = {}) => plainToInstance(CreateOkrDto, { period: '2026-S1', objective: 'o', keyResult: 'k', weight, ...over });

  it('rechaza un peso que haga pasar de 100 (400) y no inserta ni audita', async () => {
    const { service, db, audit } = build([60, 30]);
    await expect(service.createOkr(P1, okrDto(11), ACTOR)).rejects.toThrow(/no puede pasar de 100/);
    expect(db.calls.some((c) => /INSERT/.test(c.sql))).toBe(false);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('acepta justo 100', async () => {
    const { service, audit } = build([60, 30]);
    await expect(service.createOkr(P1, okrDto(10), ACTOR)).resolves.toBeDefined();
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entityType: 'job_position_okr' }));
  });

  it('la suma solo considera OKRs vivos y activos del mismo periodo (los eliminados no cuentan)', async () => {
    const { service, db } = build([]);
    await service.createOkr(P1, okrDto(10), ACTOR);
    const q = db.calls.find((c) => /SELECT weight FROM hr\.job_position_okrs/.test(c.sql))!;
    expect(q.sql).toContain('deleted_at IS NULL');
    expect(q.sql).toContain('is_active = true');
    expect(q.sql).toContain('period IS NOT DISTINCT FROM $2');
    expect(q.params).toEqual([P1, '2026-S1', null]);
  });

  it('la alta bloquea la fila del puesto antes de sumar (serializa altas simultáneas)', async () => {
    const { service, db } = build([]);
    await service.createOkr(P1, okrDto(10), ACTOR);
    const lock = db.calls.findIndex((c) => /FOR UPDATE/.test(c.sql));
    const sum = db.calls.findIndex((c) => /SELECT weight/.test(c.sql));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(sum);
    expect(db.transactions).toBe(1);
  });

  it('periodo inválido se rechaza antes de tocar la BD', async () => {
    const { service, db } = build([]);
    await expect(service.createOkr(P1, okrDto(10, { period: '2026-S3' }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.calls).toHaveLength(0);
  });

  it('editar: excluye al propio OKR de la suma y revalida contra el periodo final', async () => {
    const { service, db } = build([70], okrRow(20));
    await expect(service.updateOkr(OKR1, plainToInstance(UpdateOkrDto, { weight: 31 }), ACTOR)).rejects.toThrow(/no puede pasar de 100/);
    const q = db.calls.find((c) => /SELECT weight/.test(c.sql))!;
    expect(q.params).toEqual([P1, '2026-S1', OKR1]);
    await expect(build([70], okrRow(20)).service.updateOkr(OKR1, plainToInstance(UpdateOkrDto, { weight: 30 }), ACTOR)).resolves.toBeDefined();
  });

  it('reactivar un OKR inactivo que haría pasar de 100 se rechaza', async () => {
    const { service } = build([90], okrRow(20, { is_active: false }));
    await expect(service.updateOkr(OKR1, plainToInstance(UpdateOkrDto, { isActive: true }), ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('OKR inexistente: 404 al editar y al borrar; borrar es soft delete', async () => {
    await expect(build([], null).service.updateOkr(OKR1, plainToInstance(UpdateOkrDto, { weight: 5 }), ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    const { service, db, audit } = build([]);
    await service.removeOkr(OKR1, ACTOR);
    expect(db.calls[0]!.sql).toContain('deleted_at = NOW()');
    expect(db.calls.some((c) => /DELETE FROM/.test(c.sql))).toBe(false);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', entityType: 'job_position_okr' }));
  });

  it('KPI: frecuencia validada en el servicio, soft delete y auditoría', async () => {
    const db = fakeDb((sql) => {
      if (/FOR UPDATE/.test(sql)) return [{ id: P1, code: 'JP-001', title: 'Analista' }];
      if (/INSERT INTO hr\.job_position_kpis/.test(sql)) return [{ id: 'k1', job_position_id: P1, name: 'K', description: null, target_value: null, measurement_frequency: 'mensual', is_active: true }];
      if (/UPDATE hr\.job_position_kpis SET deleted_at/.test(sql)) return [[{ id: 'k1', name: 'K' }], 1];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    const service = new JobPositionItemsService(db.dataSource as never, audit as never);
    await expect(service.createKpi(P1, { name: 'K', measurementFrequency: 'diaria' } as never, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    await service.createKpi(P1, plainToInstance(CreateKpiDto, { name: 'K', measurementFrequency: 'mensual' }), ACTOR);
    await service.removeKpi('k1', ACTOR);
    expect(audit.logActivity).toHaveBeenCalledTimes(2);
    expect(db.calls.some((c) => /DELETE FROM/.test(c.sql))).toBe(false);
  });
});

// ── Permisos ─────────────────────────────────────────────────────────────────

describe('Matriz de Puestos · permisos y rutas', () => {
  const proto = JobPositionsController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const perm = (n: string) => Reflect.getMetadata(PERMISSION_KEY, proto[n]!);
  const p = (action: string) => ({ section: 'rrhh', module: 'matriz-puestos', action });

  it('lectura exige read', () => {
    for (const n of ['options', 'list', 'detail', 'listOkrs', 'listKpis']) expect(perm(n)).toEqual(p('read'));
  });
  it('crear puesto exige create; editar, OKRs y KPIs exigen update; eliminar puesto exige delete', () => {
    expect(perm('create')).toEqual(p('create'));
    expect(perm('update')).toEqual(p('update'));
    expect(perm('remove')).toEqual(p('delete'));
    for (const n of ['createOkr', 'updateOkr', 'removeOkr', 'createKpi', 'updateKpi', 'removeKpi']) expect(perm(n)).toEqual(p('update'));
  });
  it('aprobar exige su propio permiso approve', () => {
    expect(perm('approve')).toEqual(p('approve'));
  });
  it('todas las rutas llevan @RequirePermission (ninguna queda abierta a cualquier sesión)', () => {
    const routes = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    expect(routes.length).toBeGreaterThanOrEqual(15);
    for (const n of routes) expect(perm(n)).toBeTruthy();
  });
  it('la ruta fija options va antes de :id', () => {
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('options')).toBeLessThan(order.indexOf('detail'));
  });
});
