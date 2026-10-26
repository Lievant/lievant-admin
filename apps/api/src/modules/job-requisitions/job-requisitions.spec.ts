import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { ApproveRequisitionDto, CreateRequisitionDto, RejectRequisitionDto, ReviewQueryDto, UpdateRequisitionDto } from './dto/job-requisition.dto';
import { JobRequisitionsReviewService } from './job-requisitions-review.service';
import { JobRequisitionsController } from './job-requisitions.controller';
import { JobRequisitionsService } from './job-requisitions.service';
import {
  SUMMARY_SQL,
  assertSubmittable,
  buildResolvedMessage,
  buildReviewWhere,
  buildSubmittedMessage,
  canTransition,
  formatRequisitionCode,
  isEditable,
  nextRequisitionCode,
  normalizePosition,
  normalizeReviewComments,
  todayMx,
  toDetail,
  validateForSubmit,
  type RequisitionContent,
  type RequisitionRow,
} from './job-requisitions.util';
import { RequisitionLeaderService } from './requisition-leader.service';

const LEADER_USER = 'user-leader';
const EMP = 'emp-1';
const R1 = '11111111-1111-4111-8111-111111111111';
const POS = '22222222-2222-4222-8222-222222222222';
const HR = { id: 'user-hr', email: 'hr@lievant.com', name: 'RRHH' };
const LEADER_ACTOR = { id: LEADER_USER, email: 'lider@lievant.com', name: 'Líder' };

const valid: RequisitionContent = {
  type: 'nueva_posicion', jobPositionId: null, positionTitle: 'Analista BI', area: 'TI', reason: 'Crecimiento',
  businessJustification: 'Nuevo proyecto', requiredDate: '2099-01-10', modality: 'hibrido', country: 'mexico',
  basicProfile: 'SQL y Power BI', priority: 'alta',
};

// ── Lógica pura ──────────────────────────────────────────────────────────────

describe('Solicitud de Puesto · código consecutivo', () => {
  it('formato SOL-NNN con relleno a 3 y más si crece', () => {
    expect(formatRequisitionCode(1)).toBe('SOL-001');
    expect(formatRequisitionCode(1000)).toBe('SOL-1000');
  });
  it('continúa tras el máximo y NO reutiliza códigos de eliminados', () => {
    expect(nextRequisitionCode([])).toBe('SOL-001');
    expect(nextRequisitionCode(['SOL-001', 'SOL-002', 'SOL-003'])).toBe('SOL-004'); // SOL-003 pudo estar eliminado
    expect(nextRequisitionCode(['X', 'SOL-x', 'SOL-007'])).toBe('SOL-008');
  });
});

describe('Solicitud de Puesto · estados', () => {
  it('transiciones válidas: borrador → enviada → aprobada | rechazada', () => {
    expect(canTransition('borrador', 'enviada')).toBe(true);
    expect(canTransition('enviada', 'aprobada')).toBe(true);
    expect(canTransition('enviada', 'rechazada')).toBe(true);
  });
  it('transiciones inválidas: saltos, retrocesos y reapertura de lo resuelto', () => {
    expect(canTransition('borrador', 'aprobada')).toBe(false);
    expect(canTransition('borrador', 'rechazada')).toBe(false);
    expect(canTransition('enviada', 'borrador')).toBe(false);
    expect(canTransition('aprobada', 'rechazada')).toBe(false);
    expect(canTransition('rechazada', 'aprobada')).toBe(false);
    expect(canTransition('aprobada', 'enviada')).toBe(false);
  });
  it('solo el borrador se edita y elimina', () => {
    expect(isEditable('borrador')).toBe(true);
    for (const s of ['enviada', 'aprobada', 'rechazada'] as const) expect(isEditable(s)).toBe(false);
  });
});

describe('Solicitud de Puesto · validación al enviar', () => {
  it('una solicitud completa es válida', () => {
    expect(validateForSubmit(valid, '2026-10-26')).toEqual({});
  });
  it.each([
    ['type', { type: null }],
    ['position', { jobPositionId: null, positionTitle: null }],
    ['area', { area: ' ' }],
    ['reason', { reason: null }],
    ['businessJustification', { businessJustification: '' }],
    ['requiredDate', { requiredDate: null }],
    ['modality', { modality: null }],
    ['country', { country: null }],
    ['basicProfile', { basicProfile: null }],
    ['priority', { priority: null }],
  ])('cada obligatorio se exige: %s', (field, patch) => {
    expect(Object.keys(validateForSubmit({ ...valid, ...patch }, '2026-10-26'))).toEqual([field]);
  });
  it('el puesto puede ser de la Matriz o texto libre (basta uno)', () => {
    expect(validateForSubmit({ ...valid, jobPositionId: POS, positionTitle: null }, '2026-10-26')).toEqual({});
    expect(validateForSubmit({ ...valid, jobPositionId: null, positionTitle: 'Otro' }, '2026-10-26')).toEqual({});
  });
  it('la fecha requerida no puede ser anterior a hoy; hoy sí; fechas inexistentes no', () => {
    expect(validateForSubmit({ ...valid, requiredDate: '2026-10-25' }, '2026-10-26').requiredDate).toMatch(/anterior a hoy/);
    expect(validateForSubmit({ ...valid, requiredDate: '2026-10-26' }, '2026-10-26')).toEqual({});
    expect(validateForSubmit({ ...valid, requiredDate: '2026-02-30' }, '2026-10-26').requiredDate).toMatch(/no es válida/);
  });
  it('"hoy" se calcula en hora de México (en la madrugada UTC todavía es el día anterior)', () => {
    expect(todayMx(new Date('2026-10-27T03:00:00Z'))).toBe('2026-10-26');
    expect(todayMx(new Date('2026-10-27T07:00:00Z'))).toBe('2026-10-27');
  });
  it('enviar con errores lanza 400 con un mensaje claro por campo', () => {
    try {
      assertSubmittable({ ...valid, reason: null, priority: null }, '2026-10-26');
      fail('debió lanzar');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const body = (e as BadRequestException).getResponse() as { message: string[]; errors: Record<string, string> };
      expect(body.message).toEqual(['El motivo es obligatorio', 'La prioridad es obligatoria']);
      expect(Object.keys(body.errors)).toEqual(['reason', 'priority']);
    }
  });
  it('si hay puesto de la Matriz, el texto libre se ignora', () => {
    expect(normalizePosition(POS, 'Texto')).toEqual({ jobPositionId: POS, positionTitle: null });
    expect(normalizePosition(null, '  Texto  ')).toEqual({ jobPositionId: null, positionTitle: 'Texto' });
    expect(normalizePosition(null, '  ')).toEqual({ jobPositionId: null, positionTitle: null });
  });
});

describe('Solicitud de Puesto · comentarios de la revisión', () => {
  it('rechazar exige comentarios; aprobar los admite opcionales', () => {
    expect(() => normalizeReviewComments('rechazada', null)).toThrow(/obligatorios al rechazar/);
    expect(() => normalizeReviewComments('rechazada', '   ')).toThrow(BadRequestException);
    expect(normalizeReviewComments('rechazada', ' No hay presupuesto ')).toBe('No hay presupuesto');
    expect(normalizeReviewComments('aprobada', undefined)).toBeNull();
    expect(normalizeReviewComments('aprobada', ' ok ')).toBe('ok');
  });
});

describe('Solicitud de Puesto · textos de notificación', () => {
  const base = { code: 'SOL-001', requesterName: 'Ana Líder', type: 'nueva_posicion' as const, positionLabel: 'Analista BI', priority: 'alta', inMatrix: false };
  it('nueva posición sin puesto en la Matriz avisa que hay que crearlo', () => {
    expect(buildSubmittedMessage(base)).toContain('crearlo en la Matriz de Puestos');
  });
  it('con puesto de la Matriz, o de otro tipo, no lleva el aviso extra', () => {
    expect(buildSubmittedMessage({ ...base, inMatrix: true })).not.toContain('Matriz de Puestos');
    expect(buildSubmittedMessage({ ...base, type: 'reemplazo' })).not.toContain('Matriz de Puestos');
  });
  it('resolución con y sin comentarios', () => {
    expect(buildResolvedMessage('SOL-001', 'aprobada', null)).toBe('Tu solicitud SOL-001 fue aprobada por RRHH.');
    expect(buildResolvedMessage('SOL-001', 'rechazada', 'Sin presupuesto')).toBe('Tu solicitud SOL-001 fue rechazada por RRHH. Comentarios: Sin presupuesto');
  });
});

describe('Solicitud de Puesto · filtros de RRHH', () => {
  it('nunca incluye borradores ni eliminadas', () => {
    const { where } = buildReviewWhere({});
    expect(where).toContain("r.status <> 'borrador'");
    expect(where).toContain('r.deleted_at IS NULL');
  });
  it('estado, área, rango por día de envío en hora de México y búsqueda por código o puesto', () => {
    const { where, params } = buildReviewWhere({ status: 'enviada', area: 'TI', from: '2026-10-01', to: '2026-10-31', search: 'sol_1' });
    expect(where).toContain('r.status = $1');
    expect(where).toContain('r.area = $2');
    expect(where).toContain("(r.submitted_at AT TIME ZONE 'America/Mexico_City')::date >= $3::date");
    expect(where).toContain("(r.submitted_at AT TIME ZONE 'America/Mexico_City')::date <= $4::date");
    expect(where).toContain('r.code ILIKE $5 OR COALESCE(jp.title, r.position_title) ILIKE $5');
    expect(params).toEqual(['enviada', 'TI', '2026-10-01', '2026-10-31', '%sol\\_1%']);
  });
  it('el panel cuenta el mes calendario de México sobre la fecha de resolución', () => {
    expect(SUMMARY_SQL).toContain("date_trunc('month', reviewed_at AT TIME ZONE 'America/Mexico_City')");
    expect(SUMMARY_SQL).toContain("date_trunc('month', NOW() AT TIME ZONE 'America/Mexico_City')");
    expect(SUMMARY_SQL).toContain("FILTER (WHERE status = 'enviada')");
    expect(SUMMARY_SQL).toContain('deleted_at IS NULL');
  });
});

// ── DTO ──────────────────────────────────────────────────────────────────────

const errs = async (cls: new () => object, plain: object) => (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe('Solicitud de Puesto · DTO', () => {
  it('borrador: solo el tipo es obligatorio', async () => {
    expect(await errs(CreateRequisitionDto, { type: 'reemplazo' })).toEqual([]);
    expect(await errs(CreateRequisitionDto, {})).toContain('type');
    expect(await errs(CreateRequisitionDto, { type: 'otro' })).toContain('type');
  });
  it('catálogos y formatos', async () => {
    const ok = { type: 'temporal' };
    expect(await errs(CreateRequisitionDto, { ...ok, modality: 'remoto', country: 'eeuu', priority: 'baja', requiredDate: '2026-11-01' })).toEqual([]);
    expect(await errs(CreateRequisitionDto, { ...ok, modality: 'x' })).toContain('modality');
    expect(await errs(CreateRequisitionDto, { ...ok, country: 'peru' })).toContain('country');
    expect(await errs(CreateRequisitionDto, { ...ok, priority: 'urgente' })).toContain('priority');
    expect(await errs(CreateRequisitionDto, { ...ok, requiredDate: '01/11/2026' })).toContain('requiredDate');
    expect(await errs(CreateRequisitionDto, { ...ok, jobPositionId: 'no-uuid' })).toContain('jobPositionId');
    expect(await errs(CreateRequisitionDto, { ...ok, positionTitle: 'x'.repeat(201) })).toContain('positionTitle');
  });
  it('editar acepta null para limpiar campos', async () => {
    expect(await errs(UpdateRequisitionDto, { jobPositionId: null, reason: null, priority: null, requiredDate: null })).toEqual([]);
  });
  it('rechazar exige comentarios en el cuerpo; aprobar no', async () => {
    expect(await errs(RejectRequisitionDto, {})).toContain('comments');
    expect(await errs(RejectRequisitionDto, { comments: '' })).toContain('comments');
    expect(await errs(ApproveRequisitionDto, {})).toEqual([]);
  });
  it('filtros de RRHH: RRHH no puede pedir borradores', async () => {
    expect(await errs(ReviewQueryDto, { status: 'borrador' })).toContain('status');
    expect(await errs(ReviewQueryDto, { status: 'enviada', from: '2026-01-01', to: '2026-02-01' })).toEqual([]);
    expect(await errs(ReviewQueryDto, { from: '01-01-2026' })).toContain('from');
  });
});

// ── Líder ────────────────────────────────────────────────────────────────────

describe('Solicitud de Puesto · quién es líder', () => {
  const build = (employee: { id: string; full_name: string; area: string | null; status: string } | null, isManager: boolean) => {
    const dataSource = { query: jest.fn(async () => (employee ? [employee] : [])) };
    const vacations = { isTeamManager: jest.fn(async () => ({ isManager })) };
    return { service: new RequisitionLeaderService(dataSource as never, vacations as never), vacations };
  };
  const emp = { id: EMP, full_name: 'Ana Líder', area: 'TI', status: 'active' };

  it('líder: empleado activo vinculado con subordinados (reutiliza isTeamManager de Vacaciones)', async () => {
    const { service, vacations } = build(emp, true);
    await expect(service.resolve(LEADER_USER)).resolves.toEqual({ userId: LEADER_USER, employeeId: EMP, fullName: 'Ana Líder', area: 'TI' });
    expect(vacations.isTeamManager).toHaveBeenCalledWith(LEADER_USER);
  });
  it('sin empleado vinculado: 403 con código y mensaje claros', async () => {
    const { service, vacations } = build(null, true);
    const err: ForbiddenException = await service.resolve(LEADER_USER).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'EMPLOYEE_NOT_LINKED', message: 'Tu Usuario Aún No Está Vinculado a un Empleado' });
    expect(vacations.isTeamManager).not.toHaveBeenCalled();
  });
  it('sin subordinados: 403 NOT_A_LEADER con el mensaje claro', async () => {
    const err: ForbiddenException = await build(emp, false).service.resolve(LEADER_USER).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'NOT_A_LEADER', message: 'Esta Sección Es Para Líderes con Colaboradores a Cargo' });
  });
  it('un empleado inactivo no es líder', async () => {
    const err: ForbiddenException = await build({ ...emp, status: 'inactive' }, true).service.resolve(LEADER_USER).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'NOT_A_LEADER' });
  });
});

// ── Servicio del líder con BD simulada ───────────────────────────────────────

interface Call { sql: string; params: unknown[] }

function fakeDb(handler: (sql: string, params: unknown[]) => unknown) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return handler(sql, params);
  });
  return { dataSource: { query, transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb({ query })) }, calls };
}

const row = (over: Partial<RequisitionRow> & { required_date_text?: string | null } = {}): RequisitionRow & { required_date_text?: string | null } => ({
  id: R1, code: 'SOL-001', requester_employee_id: EMP, requester_user_id: LEADER_USER, requester_name: 'Ana Líder',
  type: 'nueva_posicion', job_position_id: null, job_position_code: null, position_label: 'Analista BI', position_title: 'Analista BI',
  area: 'TI', reason: 'r', business_justification: 'j', required_date: '2099-01-10', required_date_text: '2099-01-10', modality: 'hibrido', country: 'mexico',
  basic_profile: 'p', priority: 'alta', status: 'borrador', submitted_at: null, reviewed_by: null, reviewer_name: null,
  reviewed_at: null, review_comments: null, created_at: new Date('2026-10-01'), ...over,
});

describe('Solicitud de Puesto · servicio del líder', () => {
  const build = (current: ReturnType<typeof row> | null, opts: { positionActive?: boolean; leaderOk?: boolean; notifyFails?: boolean } = {}) => {
    const db = fakeDb((sql, params) => {
      if (/SELECT code FROM hr\.job_requisitions/.test(sql)) return [{ code: 'SOL-001' }, { code: 'SOL-002' }];
      if (/INSERT INTO hr\.job_requisitions/.test(sql)) return [{ id: R1 }];
      if (/FOR UPDATE/.test(sql)) return current && current.requester_employee_id === params[1] ? [current] : [];
      if (/FROM hr\.job_positions WHERE id = \$1/.test(sql)) return opts.positionActive === false ? [] : [{ '?column?': 1 }];
      if (/REQUISITION|FROM hr\.job_requisitions r\s+JOIN/.test(sql)) return current && current.requester_employee_id === params[1] ? [current] : [];
      if (/FROM hr\.job_positions/.test(sql)) return [{ id: POS, code: 'JP-001', title: 'Analista', area: 'TI' }];
      return [];
    });
    const leaders = {
      resolve: jest.fn(async (userId: string) => {
        if (opts.leaderOk === false) throw new ForbiddenException({ code: 'NOT_A_LEADER', message: 'x' });
        return { userId, employeeId: EMP, fullName: 'Ana Líder', area: 'TI' };
      }),
    };
    const audit = { logActivity: jest.fn(async () => undefined) };
    const flows = { notify: jest.fn(async () => { if (opts.notifyFails) throw new Error('smtp caído'); return 1; }) };
    return { service: new JobRequisitionsService(db.dataSource as never, leaders as never, audit as never, flows as never), db, audit, flows, leaders };
  };

  it('alta de borrador: código consecutivo bajo candado, solicitante de la sesión, área del líder por defecto', async () => {
    const { service, db, audit } = build(row());
    await service.create(LEADER_USER, plainToInstance(CreateRequisitionDto, { type: 'nueva_posicion' }), LEADER_ACTOR);
    expect(db.calls[0]!.sql).toContain('pg_advisory_xact_lock');
    const select = db.calls.find((c) => /SELECT code FROM hr\.job_requisitions/.test(c.sql))!;
    expect(select.sql).not.toContain('deleted_at');
    const insert = db.calls.find((c) => /INSERT INTO hr\.job_requisitions/.test(c.sql))!;
    expect(insert.params.slice(0, 4)).toEqual(['SOL-003', EMP, LEADER_USER, 'nueva_posicion']);
    expect(insert.params[6]).toBe('TI');
    expect(insert.sql).not.toMatch(/status/); // el estado nace en borrador por defecto de la tabla
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', module: 'solicitudes-puesto', entityType: 'job_requisition' }));
  });

  it('un puesto de la Matriz inactivo o inexistente se rechaza al guardar; con puesto de la Matriz el texto libre se ignora', async () => {
    const bad = build(row(), { positionActive: false });
    await expect(bad.service.create(LEADER_USER, plainToInstance(CreateRequisitionDto, { type: 'reemplazo', jobPositionId: POS }), LEADER_ACTOR)).rejects.toThrow(/no está disponible/);
    expect(bad.db.calls.some((c) => /INSERT/.test(c.sql))).toBe(false);
    const ok = build(row());
    await ok.service.create(LEADER_USER, plainToInstance(CreateRequisitionDto, { type: 'reemplazo', jobPositionId: POS, positionTitle: 'Ignorado' }), LEADER_ACTOR);
    const insert = ok.db.calls.find((c) => /INSERT INTO/.test(c.sql))!;
    expect(insert.params[4]).toBe(POS);
    expect(insert.params[5]).toBeNull();
  });

  it('un no líder no puede usar nada: se rechaza antes de tocar la BD', async () => {
    const { service, db } = build(row(), { leaderOk: false });
    await expect(service.listMine(LEADER_USER, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create(LEADER_USER, plainToInstance(CreateRequisitionDto, { type: 'temporal' }), LEADER_ACTOR)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.positionOptions(LEADER_USER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.calls).toHaveLength(0);
  });

  it('un líder no accede a una solicitud ajena: 404 (no 403) en ver, editar, enviar y eliminar', async () => {
    const foreign = row({ requester_employee_id: 'otro-empleado' });
    const { service } = build(foreign);
    await expect(service.getMine(LEADER_USER, R1)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(LEADER_USER, R1, plainToInstance(UpdateRequisitionDto, { reason: 'x' }), LEADER_ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.submit(LEADER_USER, R1, LEADER_ACTOR)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(LEADER_USER, R1, LEADER_ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el listado se acota al expediente de la sesión, excluye eliminadas y ordena por creación descendente', async () => {
    const db = fakeDb(() => [{ ...row(), total_count: 31 }]);
    const leaders = { resolve: jest.fn(async () => ({ userId: LEADER_USER, employeeId: EMP, fullName: 'x', area: 'TI' })) };
    const service = new JobRequisitionsService(db.dataSource as never, leaders as never, { logActivity: jest.fn() } as never, { notify: jest.fn() } as never);
    const res = await service.listMine(LEADER_USER, { status: 'borrador', page: 2, limit: 10 } as never);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]!.sql).toContain('r.requester_employee_id = $1');
    expect(db.calls[0]!.sql).toContain('r.deleted_at IS NULL');
    expect(db.calls[0]!.sql).toContain('ORDER BY r.created_at DESC');
    expect(db.calls[0]!.params).toEqual([EMP, 'borrador', 10, 10]);
    expect(res).toMatchObject({ total: 31, page: 2, totalPages: 4 });
  });

  it('editar y eliminar solo en borrador: una enviada responde 409 y no se modifica', async () => {
    const sent = row({ status: 'enviada' });
    const { service, db, audit } = build(sent);
    await expect(service.update(LEADER_USER, R1, plainToInstance(UpdateRequisitionDto, { reason: 'x' }), LEADER_ACTOR)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.remove(LEADER_USER, R1, LEADER_ACTOR)).rejects.toBeInstanceOf(ConflictException);
    expect(db.calls.some((c) => /UPDATE hr\.job_requisitions/.test(c.sql))).toBe(false);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('eliminar un borrador es baja lógica con auditoría', async () => {
    const { service, db, audit } = build(row());
    await service.remove(LEADER_USER, R1, LEADER_ACTOR);
    expect(db.calls.some((c) => /SET deleted_at = NOW\(\)/.test(c.sql))).toBe(true);
    expect(db.calls.some((c) => /DELETE FROM/.test(c.sql))).toBe(false);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
  });

  it('editar valida el estado combinado y deja auditoría', async () => {
    const { service, db, audit } = build(row());
    await service.update(LEADER_USER, R1, plainToInstance(UpdateRequisitionDto, { priority: 'baja', jobPositionId: POS }), LEADER_ACTOR);
    const up = db.calls.find((c) => /UPDATE hr\.job_requisitions SET type/.test(c.sql))!;
    expect(up.params[2]).toBe(POS);
    expect(up.params[3]).toBeNull(); // el texto libre se ignora con puesto de la Matriz
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
  });

  it('enviar con campos faltantes: 400 y NO cambia el estado ni notifica', async () => {
    const { service, db, flows, audit } = build(row({ reason: null, priority: null }));
    await expect(service.submit(LEADER_USER, R1, LEADER_ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.calls.some((c) => /status = 'enviada'/.test(c.sql))).toBe(false);
    expect(flows.notify).not.toHaveBeenCalled();
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('enviar con fecha pasada se rechaza', async () => {
    const { service } = build(row({ required_date: '2020-01-01', required_date_text: '2020-01-01' }));
    const err: BadRequestException = await service.submit(LEADER_USER, R1, LEADER_ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err.getResponse() as { message: string[] }).message.join(' ')).toMatch(/anterior a hoy/);
  });

  it('enviar: pasa a enviada, audita y notifica al flujo de quienes aprueban con aviso de crear el puesto en la Matriz', async () => {
    const { service, db, flows, audit } = build(row());
    await service.submit(LEADER_USER, R1, LEADER_ACTOR);
    expect(db.calls.some((c) => /status = 'enviada', submitted_at = NOW\(\)/.test(c.sql))).toBe(true);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'submit' }));
    expect(flows.notify).toHaveBeenCalledWith('rrhh', 'solicitud_puesto_enviada', expect.objectContaining({
      requesterId: LEADER_USER, actorId: LEADER_USER, entityType: 'job_requisition',
      message: expect.stringContaining('crearlo en la Matriz de Puestos'),
    }));
  });

  it('un fallo al notificar NO revierte el envío', async () => {
    const { service, db } = build(row(), { notifyFails: true });
    const res = await service.submit(LEADER_USER, R1, LEADER_ACTOR);
    expect(res.code).toBe('SOL-001');
    expect(db.calls.some((c) => /status = 'enviada'/.test(c.sql))).toBe(true);
  });

  it('las opciones de puesto traen solo id, código, título y área, y solo de puestos activos', async () => {
    const { service, db } = build(row());
    await service.positionOptions(LEADER_USER);
    const q = db.calls[0]!;
    expect(q.sql).toMatch(/SELECT id, code, title, area FROM hr\.job_positions/);
    expect(q.sql).toContain("status = 'activo'");
    expect(q.sql).toContain('deleted_at IS NULL');
    expect(q.sql).not.toMatch(/description|okr|kpi/i);
  });
});

// ── Servicio de RRHH ─────────────────────────────────────────────────────────

describe('Solicitud de Puesto · servicio de RRHH', () => {
  const build = (current: { id: string; code: string; status: string; requester_user_id: string } | null, opts: { notifyFails?: boolean } = {}) => {
    const db = fakeDb((sql) => {
      if (/FOR UPDATE/.test(sql)) return current ? [current] : [];
      if (/FROM hr\.job_requisitions r\s+JOIN/.test(sql)) return current ? [row({ status: 'aprobada', reviewed_by: HR.id, reviewer_name: 'RRHH' })] : [];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    const flows = { notify: jest.fn(async () => { if (opts.notifyFails) throw new Error('boom'); return 1; }) };
    return { service: new JobRequisitionsReviewService(db.dataSource as never, audit as never, flows as never), db, audit, flows };
  };
  const sent = { id: R1, code: 'SOL-001', status: 'enviada', requester_user_id: LEADER_USER };

  it('aprobar solo una enviada: guarda quién y cuándo, audita y notifica al solicitante', async () => {
    const { service, db, audit, flows } = build(sent);
    await service.approve(R1, 'Adelante', HR);
    const up = db.calls.find((c) => /UPDATE hr\.job_requisitions SET status/.test(c.sql))!;
    expect(up.sql).toContain('reviewed_at = NOW()');
    expect(up.params).toEqual([R1, 'aprobada', 'user-hr', 'Adelante']);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', entityType: 'job_requisition', userId: 'user-hr' }));
    expect(flows.notify).toHaveBeenCalledWith('rrhh', 'solicitud_puesto_resuelta', expect.objectContaining({
      requesterId: LEADER_USER, actorId: 'user-hr', notificationType: 'informativa',
      message: 'Tu solicitud SOL-001 fue aprobada por RRHH. Comentarios: Adelante',
    }));
  });

  it('rechazar sin comentarios falla antes de tocar la BD; con comentarios notifica con tipo atención', async () => {
    const none = build(sent);
    await expect(none.service.reject(R1, '  ', HR)).rejects.toBeInstanceOf(BadRequestException);
    expect(none.db.calls).toHaveLength(0);
    const ok = build(sent);
    await ok.service.reject(R1, 'Sin presupuesto', HR);
    expect(ok.audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'reject' }));
    expect(ok.flows.notify).toHaveBeenCalledWith('rrhh', 'solicitud_puesto_resuelta', expect.objectContaining({ notificationType: 'atencion' }));
  });

  it('nadie resuelve su propia solicitud: 403 con mensaje claro y no se modifica nada', async () => {
    const own = { ...sent, requester_user_id: HR.id };
    const { service, db, flows } = build(own);
    const err: ForbiddenException = await service.approve(R1, null, HR).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.message).toBe('No puedes resolver tu propia solicitud');
    await expect(service.reject(R1, 'x', HR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.calls.some((c) => /UPDATE hr\.job_requisitions/.test(c.sql))).toBe(false);
    expect(flows.notify).not.toHaveBeenCalled();
  });

  it('una solicitud que no está enviada no se resuelve (ni se reabre lo ya resuelto): 409', async () => {
    for (const status of ['aprobada', 'rechazada']) {
      const { service, db } = build({ ...sent, status });
      await expect(service.approve(R1, null, HR)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.reject(R1, 'x', HR)).rejects.toBeInstanceOf(ConflictException);
      expect(db.calls.some((c) => /UPDATE hr\.job_requisitions/.test(c.sql))).toBe(false);
    }
  });

  it('RRHH no ve borradores: la consulta del bloqueo y del detalle los excluyen (404)', async () => {
    const { service, db } = build(null);
    await expect(service.approve(R1, null, HR)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getDetail(R1)).rejects.toBeInstanceOf(NotFoundException);
    expect(db.calls.every((c) => c.sql.includes("status <> 'borrador'"))).toBe(true);
  });

  it('un fallo al notificar NO revierte la resolución', async () => {
    const { service, db } = build(sent, { notifyFails: true });
    const res = await service.approve(R1, null, HR);
    expect(res.status).toBe('aprobada');
    expect(db.calls.some((c) => /UPDATE hr\.job_requisitions SET status/.test(c.sql))).toBe(true);
  });

  it('listado: una consulta con total, orden por envío descendente y paginación; solo no borradores', async () => {
    const db = fakeDb(() => [{ ...row({ status: 'enviada' }), total_count: 53 }]);
    const service = new JobRequisitionsReviewService(db.dataSource as never, { logActivity: jest.fn() } as never, { notify: jest.fn() } as never);
    const res = await service.list(plainToInstance(ReviewQueryDto, { status: 'enviada', area: 'TI', page: 2, limit: 10 }));
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]!.sql).toContain('COUNT(*) OVER()');
    expect(db.calls[0]!.sql).toContain('ORDER BY r.submitted_at DESC');
    expect(db.calls[0]!.sql).toContain("r.status <> 'borrador'");
    expect(db.calls[0]!.params).toEqual(['enviada', 'TI', 10, 10]);
    expect(res).toMatchObject({ total: 53, totalPages: 6 });
  });

  it('el panel devuelve los tres conteos', async () => {
    const db = fakeDb(() => [{ pending: '4', approved_this_month: '2', rejected_this_month: '1' }]);
    const service = new JobRequisitionsReviewService(db.dataSource as never, { logActivity: jest.fn() } as never, { notify: jest.fn() } as never);
    await expect(service.getSummary()).resolves.toEqual({ pending: 4, approvedThisMonth: 2, rejectedThisMonth: 1 });
  });

  it('el detalle no expone ids de auditoría crudos y resuelve nombres en el mismo JOIN', async () => {
    const d = toDetail(row({ status: 'aprobada', reviewed_by: 'u9', reviewer_name: 'Claudia', reviewed_at: new Date('2026-10-02T12:00:00Z'), review_comments: 'ok' }));
    expect(d.reviewedBy).toEqual({ id: 'u9', name: 'Claudia' });
    expect(d.requesterName).toBe('Ana Líder');
    expect(JSON.stringify(d)).not.toMatch(/requester_user_id|requesterUserId|deleted/);
    expect(d.needsMatrixPosition).toBe(true);
  });
});

// ── Permisos y rutas ─────────────────────────────────────────────────────────

describe('Solicitud de Puesto · permisos y rutas', () => {
  const proto = JobRequisitionsController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const perm = (n: string) => Reflect.getMetadata(PERMISSION_KEY, proto[n]!);
  const p = (action: string) => ({ section: 'rrhh', module: 'solicitudes-puesto', action });

  it('las rutas de líder son solo de sesión (la verificación de líder la hace el servicio)', () => {
    for (const n of ['myPositionOptions', 'listMine', 'createMine', 'getMine', 'updateMine', 'submitMine', 'removeMine']) {
      expect(perm(n)).toBeNull();
    }
  });
  it('lectura de RRHH exige read; aprobar y rechazar exigen approve', () => {
    for (const n of ['summary', 'options', 'list', 'detail']) expect(perm(n)).toEqual(p('read'));
    expect(perm('approve')).toEqual(p('approve'));
    expect(perm('reject')).toEqual(p('approve'));
  });
  it('las rutas fijas van antes de :id', () => {
    const order = Object.getOwnPropertyNames(proto);
    for (const n of ['myPositionOptions', 'listMine', 'getMine', 'summary', 'options']) {
      expect(order.indexOf(n)).toBeLessThan(order.indexOf('detail'));
    }
    expect(order.indexOf('myPositionOptions')).toBeLessThan(order.indexOf('getMine'));
  });
  it('ninguna ruta queda sin decisión de acceso (permiso o sesión explícita)', () => {
    const routes = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor');
    expect(routes.length).toBe(13);
    for (const n of routes) expect(perm(n)).not.toBeUndefined();
  });
});
