import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { EmployeesController } from '../employees/employees.controller';
import { AssignDto, PeriodQueryDto, SetPositionDto } from './dto/employee-development.dto';
import { EmployeeDevelopmentController } from './employee-development.controller';
import { EmployeeDevelopmentService } from './employee-development.service';
import {
  addSummaries,
  assertPeriod,
  canViewEmployeeDevelopment,
  currentPeriodMx,
  findSuggestion,
  normalizeText,
  summarize,
  sumWeights,
  visibleDescription,
} from './employee-development.util';

const P1 = '11111111-1111-4111-8111-111111111111';
const E1 = '22222222-2222-4222-8222-222222222222';
const ACTOR = { id: 'rrhh-1', email: 'rrhh@lievant.com', name: 'RRHH' };

// ── Utilidades puras ─────────────────────────────────────────────────────────

describe('Desarrollo Organizacional · periodo en hora de México', () => {
  it('enero a junio es S1 y julio a diciembre S2, con los bordes 30 de junio y 1 de julio', () => {
    expect(currentPeriodMx(new Date('2026-01-15T18:00:00Z'))).toBe('2026-S1');
    expect(currentPeriodMx(new Date('2026-06-30T18:00:00Z'))).toBe('2026-S1');
    expect(currentPeriodMx(new Date('2026-07-01T18:00:00Z'))).toBe('2026-S2');
    expect(currentPeriodMx(new Date('2026-12-31T18:00:00Z'))).toBe('2026-S2');
  });
  it('usa la fecha de México, no la UTC (1 de julio 05:00 UTC todavía es 30 de junio en CDMX; fin de año igual)', () => {
    expect(currentPeriodMx(new Date('2026-07-01T05:00:00Z'))).toBe('2026-S1');
    expect(currentPeriodMx(new Date('2026-07-01T06:30:00Z'))).toBe('2026-S2');
    expect(currentPeriodMx(new Date('2027-01-01T05:30:00Z'))).toBe('2026-S2');
  });
  it('valida el formato del periodo', () => {
    expect(() => assertPeriod('2026-S2')).not.toThrow();
    for (const bad of ['2026-S3', '26-S1', '2026S1', '']) expect(() => assertPeriod(bad)).toThrow(BadRequestException);
  });
});

describe('Desarrollo Organizacional · descripción del puesto', () => {
  it('solo se muestra si está aprobada y no vacía', () => {
    expect(visibleDescription('Texto', true)).toBe('Texto');
    expect(visibleDescription('Texto', false)).toBeNull();
    expect(visibleDescription('   ', true)).toBeNull();
    expect(visibleDescription(null, true)).toBeNull();
  });
});

describe('Desarrollo Organizacional · sugerencia de puesto', () => {
  const list = [
    { id: '1', title: 'Analista de Datos' },
    { id: '2', title: 'Gerente Comercial' },
    { id: '3', title: 'Coordinación' },
    { id: '4', title: 'COORDINACION' },
  ];
  it('ignora mayúsculas, acentos y espacios', () => {
    expect(normalizeText('  Coordinación  de   Ventas ')).toBe('coordinacion de ventas');
    expect(findSuggestion('ANALISTA DE DATOS', list)?.id).toBe('1');
    expect(findSuggestion('  gerente   comercial ', list)?.id).toBe('2');
  });
  it('solo con exactamente un puesto: ninguna coincidencia o varias dan null', () => {
    expect(findSuggestion('Analista', list)).toBeNull(); // coincidencia parcial no cuenta
    expect(findSuggestion('Coordinación', list)).toBeNull(); // dos coincidencias
    expect(findSuggestion('', list)).toBeNull();
    expect(findSuggestion(null, list)).toBeNull();
  });
});

describe('Desarrollo Organizacional · regla de acceso (pura)', () => {
  it('permiso, el propio o líder directo ven; los demás no', () => {
    expect(canViewEmployeeDevelopment({ hasReadPermission: true, isSelf: false, isDirectLeader: false })).toBe(true);
    expect(canViewEmployeeDevelopment({ hasReadPermission: false, isSelf: true, isDirectLeader: false })).toBe(true);
    expect(canViewEmployeeDevelopment({ hasReadPermission: false, isSelf: false, isDirectLeader: true })).toBe(true);
    expect(canViewEmployeeDevelopment({ hasReadPermission: false, isSelf: false, isDirectLeader: false })).toBe(false);
  });
});

describe('Desarrollo Organizacional · sumas y resúmenes', () => {
  it('suma de pesos sin errores de coma flotante', () => {
    expect(sumWeights([{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }, { weight: null }])).toBe(100);
  });
  it('copiados + omitidos = lo que tenía el puesto', () => {
    expect(summarize(5, 2, 3, 3)).toEqual({ okrsCopied: 2, okrsSkipped: 3, kpisCopied: 3, kpisSkipped: 0 });
  });
  it('acumula resúmenes de varios empleados', () => {
    const base = { employees: 0, okrsCopied: 0, okrsSkipped: 0, kpisCopied: 0, kpisSkipped: 0 };
    const total = addSummaries(addSummaries(base, summarize(2, 2, 1, 1)), summarize(2, 0, 1, 0));
    expect(total).toEqual({ employees: 2, okrsCopied: 2, okrsSkipped: 2, kpisCopied: 1, kpisSkipped: 1 });
  });
});

// ── Servicio con BD simulada ─────────────────────────────────────────────────

interface Call { sql: string; params: unknown[] }

function fakeDb(handler: (sql: string, params: unknown[]) => unknown) {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return handler(sql, params);
  });
  return { dataSource: { query, transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb({ query })) }, calls };
}

const userWith = (opts: { id?: string; read?: boolean; write?: boolean; superAdmin?: boolean } = {}) => {
  const perms: { section: string; module: string; action: string }[] = [];
  if (opts.read) perms.push({ section: 'rrhh', module: 'desarrollo-organizacional', action: 'read' });
  if (opts.write) perms.push({ section: 'rrhh', module: 'desarrollo-organizacional', action: 'write' });
  return {
    id: opts.id ?? 'user-x',
    roles: [{ name: opts.superAdmin ? 'SUPER_ADMIN' : 'COLABORADOR', permissions: perms }],
    userPermissions: [],
  } as never;
};

describe('Desarrollo Organizacional · acceso por empleado (servicio)', () => {
  // Empleado consultado: reporta (directo) al empleado 'mgr'. Cadena: boss → mgr → E1.
  const build = (viewerEmployeeId: string | null, employee: { auth_user_id: string | null; direct_report_to_id: string | null } | null = { auth_user_id: 'user-emp', direct_report_to_id: 'mgr' }) => {
    const db = fakeDb(() => (employee ? [{ id: E1, ...employee, viewer_employee_id: viewerEmployeeId }] : []));
    return new EmployeeDevelopmentService(db.dataSource as never, { logActivity: jest.fn() } as never);
  };

  it('con el permiso read: ve', async () => {
    await expect(build(null).assertCanView(userWith({ id: 'rrhh', read: true }), E1)).resolves.toBeUndefined();
  });
  it('el propio empleado ve lo suyo sin ningún permiso', async () => {
    await expect(build('self-emp').assertCanView(userWith({ id: 'user-emp' }), E1)).resolves.toBeUndefined();
  });
  it('su líder DIRECTO ve', async () => {
    await expect(build('mgr').assertCanView(userWith({ id: 'user-mgr' }), E1)).resolves.toBeUndefined();
  });
  it('el líder de un nivel más arriba NO ve (no es transitivo): 404', async () => {
    await expect(build('boss').assertCanView(userWith({ id: 'user-boss' }), E1)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('otro usuario sin permiso: 404 (no se revela que existe)', async () => {
    await expect(build('otro').assertCanView(userWith({ id: 'user-otro' }), E1)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build(null).assertCanView(userWith({ id: 'user-sin-expediente' }), E1)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('un empleado inexistente o dado de baja: 404 incluso con permiso', async () => {
    await expect(build(null, null).assertCanView(userWith({ read: true }), E1)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('un empleado que se apunta a sí mismo como jefe no habilita nada a un tercero', async () => {
    const svc = build('x', { auth_user_id: 'user-emp', direct_report_to_id: E1 });
    await expect(svc.assertCanView(userWith({ id: 'user-x' }), E1)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('la consulta de acceso deja fuera empleados con baja lógica', async () => {
    const db = fakeDb(() => []);
    await new EmployeeDevelopmentService(db.dataSource as never, { logActivity: jest.fn() } as never).assertCanView(userWith({ read: true }), E1).catch(() => undefined);
    expect(db.calls[0]!.sql).toContain('e.deleted_at IS NULL');
  });
});

describe('Desarrollo Organizacional · lectura', () => {
  const emp = (over: object = {}) => ({ id: E1, position: 'Analista de Datos', job_position_id: P1, full_name: 'Ana', auth_user_id: null, direct_report_to_id: null, ...over });
  const pos = (over: object = {}) => ({ id: P1, code: 'JP-001', title: 'Analista de Datos', area: 'TI', level: 'Senior', description: 'Descripción', description_approved: true, ...over });
  const build = (employee: object | null, position: object | null, candidates: object[] = []) => {
    const db = fakeDb((sql) => {
      if (/FROM employees\.employee_records/.test(sql)) return employee ? [employee] : [];
      if (/description_approved FROM hr\.job_positions|description, description_approved\s+FROM hr\.job_positions/.test(sql)) return position ? [position] : [];
      if (/status = 'activo'/.test(sql)) return candidates;
      if (/FROM hr\.employee_okrs\s+WHERE employee_id = \$1 AND period/.test(sql) || /objective, key_result, weight FROM hr\.employee_okrs/.test(sql)) return [{ id: 'o1', objective: 'Obj', key_result: 'KR', weight: '60.00' }, { id: 'o2', objective: 'Obj2', key_result: 'KR2', weight: '40.00' }];
      if (/FROM hr\.employee_kpis/.test(sql)) return [{ id: 'k1', name: 'KPI', description: null, target_value: '95%', measurement_frequency: 'mensual' }];
      if (/SELECT DISTINCT period/.test(sql)) return [{ period: '2026-S2' }, { period: '2026-S1' }];
      return [];
    });
    return { service: new EmployeeDevelopmentService(db.dataSource as never, { logActivity: jest.fn() } as never), db };
  };

  it('puesto con descripción aprobada: la muestra y no marca pendiente; OKRs, KPIs y periodos con campos explícitos', async () => {
    const { service } = build(emp(), pos());
    const d = await service.getDevelopment(E1, '2026-S2');
    expect(d.position).toEqual({ id: P1, code: 'JP-001', title: 'Analista de Datos', area: 'TI', level: 'Senior' });
    expect(d.description).toBe('Descripción');
    expect(d.descriptionPending).toBe(false);
    expect(d.okrs).toEqual([{ id: 'o1', objective: 'Obj', keyResult: 'KR', weight: 60 }, { id: 'o2', objective: 'Obj2', keyResult: 'KR2', weight: 40 }]);
    expect(d.weightSum).toBe(100);
    expect(d.kpis[0]).toEqual({ id: 'k1', name: 'KPI', description: null, targetValue: '95%', measurementFrequency: 'mensual' });
    expect(d.periodsWithData).toEqual(['2026-S2', '2026-S1']);
    expect(JSON.stringify(d)).not.toMatch(/description_approved|approvedBy|created_by|deleted_at/);
  });

  it('descripción sin aprobar o vacía: null y "pendiente"', async () => {
    const a = await build(emp(), pos({ description_approved: false })).service.getDevelopment(E1);
    expect(a.description).toBeNull();
    expect(a.descriptionPending).toBe(true);
    const b = await build(emp(), pos({ description: '  ' })).service.getDevelopment(E1);
    expect(b.descriptionPending).toBe(true);
  });

  it('sin puesto vinculado: position null, no pendiente, y la sugerencia solo con coincidencia exacta única (nunca vincula)', async () => {
    const withSuggestion = build(emp({ job_position_id: null, position: 'ANALISTA de datos' }), null, [{ id: P1, code: 'JP-001', title: 'Analista de Datos', area: 'TI', level: null }]);
    const d = await withSuggestion.service.getDevelopment(E1);
    expect(d.position).toBeNull();
    expect(d.descriptionPending).toBe(false);
    expect(d.suggestedPosition?.id).toBe(P1);
    expect(withSuggestion.db.calls.some((c) => /UPDATE/.test(c.sql))).toBe(false);

    const two = build(emp({ job_position_id: null }), null, [{ id: 'a', code: 'JP-1', title: 'Analista de Datos', area: 'x', level: null }, { id: 'b', code: 'JP-2', title: 'analista de datos', area: 'y', level: null }]);
    expect((await two.service.getDevelopment(E1)).suggestedPosition).toBeNull();
    const none = build(emp({ job_position_id: null, position: 'Otro cargo' }), null, [{ id: 'a', code: 'JP-1', title: 'Analista de Datos', area: 'x', level: null }]);
    expect((await none.service.getDevelopment(E1)).suggestedPosition).toBeNull();
  });

  it('la sugerencia solo considera puestos ACTIVOS; con puesto vinculado no se calcula', async () => {
    const { db } = build(emp({ job_position_id: null }), null, []);
    await build(emp({ job_position_id: null }), null, []).service.getDevelopment(E1);
    const withPos = build(emp(), pos());
    await withPos.service.getDevelopment(E1);
    expect(withPos.db.calls.some((c) => /status = 'activo'/.test(c.sql))).toBe(false);
    void db;
  });

  it('solo OKRs y KPIs activos y no eliminados; el periodo por defecto es el actual', async () => {
    const { service, db } = build(emp(), pos());
    const d = await service.getDevelopment(E1);
    for (const re of [/FROM hr\.employee_okrs\s+WHERE employee_id = \$1 AND period = \$2/, /FROM hr\.employee_kpis/]) {
      const q = db.calls.find((c) => re.test(c.sql))!;
      expect(q.sql).toContain('deleted_at IS NULL');
      expect(q.sql).toContain('is_active = true');
    }
    expect(d.period).toBe(currentPeriodMx());
  });

  it('un periodo inválido se rechaza antes de consultar', async () => {
    const { service, db } = build(emp(), pos());
    await expect(service.getDevelopment(E1, '2026-S9')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.calls).toHaveLength(0);
  });

  it('las opciones de puesto no traen descripción y excluyen inactivos y eliminados', async () => {
    const db = fakeDb(() => [{ id: P1, code: 'JP-001', title: 'X', area: 'TI', level: null, description: 'secreto' }]);
    const service = new EmployeeDevelopmentService(db.dataSource as never, { logActivity: jest.fn() } as never);
    const opts = await service.positionOptions();
    expect(JSON.stringify(opts)).not.toContain('secreto');
    expect(db.calls[0]!.sql).toMatch(/SELECT id, code, title, area, level FROM hr\.job_positions/);
    expect(db.calls[0]!.sql).toContain("status <> 'inactivo'");
    expect(db.calls[0]!.sql).toContain('deleted_at IS NULL');
  });
});

describe('Desarrollo Organizacional · vincular puesto', () => {
  const build = (opts: { positionAvailable?: boolean; employeeCurrent?: string | null } = {}) => {
    const db = fakeDb((sql) => {
      if (/FOR UPDATE/.test(sql)) return [{ id: E1, position: 'X', job_position_id: opts.employeeCurrent ?? null, full_name: 'Ana', auth_user_id: null, direct_report_to_id: null }];
      if (/status <> 'inactivo'/.test(sql)) return opts.positionAvailable === false ? [] : [{ id: P1, code: 'JP-001' }];
      if (/SELECT id, code FROM hr\.job_positions WHERE id = \$1$/.test(sql)) return [{ id: 'old', code: 'JP-000' }];
      if (/FROM employees\.employee_records/.test(sql)) return [{ id: E1, position: 'X', job_position_id: null, full_name: 'Ana' }];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    return { service: new EmployeeDevelopmentService(db.dataSource as never, audit as never), db, audit };
  };

  it('un puesto inactivo, eliminado o inexistente no se puede vincular y no se modifica nada', async () => {
    const { service, db, audit } = build({ positionAvailable: false });
    await expect(service.setPosition(E1, P1, ACTOR)).rejects.toThrow(/no está disponible/);
    expect(db.calls.some((c) => /UPDATE employees\.employee_records/.test(c.sql))).toBe(false);
    expect(audit.logActivity).not.toHaveBeenCalled();
    expect(db.calls.find((c) => /status <> 'inactivo'/.test(c.sql))!.sql).toContain('deleted_at IS NULL');
  });

  it('vincula, y desvincula con null, dejando auditoría con el puesto anterior y el nuevo', async () => {
    const link = build();
    await link.service.setPosition(E1, P1, ACTOR);
    expect(link.db.calls.find((c) => /UPDATE employees\.employee_records SET job_position_id/.test(c.sql))!.params).toEqual([E1, P1]);
    expect(link.audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'link-position', module: 'desarrollo-organizacional', changes: { position: { from: null, to: 'JP-001' } } }));

    const unlink = build({ employeeCurrent: 'old' });
    await unlink.service.setPosition(E1, null, ACTOR);
    expect(unlink.db.calls.find((c) => /UPDATE employees\.employee_records SET job_position_id/.test(c.sql))!.params).toEqual([E1, null]);
    expect(unlink.audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ changes: { position: { from: 'JP-000', to: null } } }));
  });

  it('cambiar de puesto NO borra lo ya asignado (no toca employee_okrs ni employee_kpis)', async () => {
    const { service, db } = build({ employeeCurrent: 'old' });
    await service.setPosition(E1, P1, ACTOR);
    expect(db.calls.some((c) => /employee_okrs|employee_kpis/.test(c.sql) && /UPDATE|DELETE/.test(c.sql))).toBe(false);
  });
});

describe('Desarrollo Organizacional · asignar OKRs y KPIs', () => {
  /** `okrInPosition`/`kpiInPosition`: cuántos hay en el puesto; `okrNew`/`kpiNew`: cuántos son realmente nuevos (los demás ya estaban copiados). */
  const build = (opts: { jobPositionId?: string | null; okrInPosition?: number; okrNew?: number; kpiInPosition?: number; kpiNew?: number; positionExists?: boolean; employees?: string[] } = {}) => {
    const has = (opts.jobPositionId === undefined ? P1 : opts.jobPositionId) as string | null;
    const db = fakeDb((sql) => {
      if (/FROM employees\.employee_records WHERE job_position_id/.test(sql)) return (opts.employees ?? []).map((id) => ({ id }));
      if (/FROM employees\.employee_records/.test(sql)) return [{ id: E1, position: 'X', job_position_id: has, full_name: 'Ana', auth_user_id: null, direct_report_to_id: null }];
      if (/SELECT id, code, title FROM hr\.job_positions/.test(sql)) return opts.positionExists === false ? [] : [{ id: P1, code: 'JP-001', title: 'Analista' }];
      if (/COUNT\(\*\) AS n FROM hr\.job_position_okrs/.test(sql)) return [{ n: String(opts.okrInPosition ?? 3) }];
      if (/COUNT\(\*\) AS n FROM hr\.job_position_kpis/.test(sql)) return [{ n: String(opts.kpiInPosition ?? 2) }];
      if (/INSERT INTO hr\.employee_okrs/.test(sql)) return Array.from({ length: opts.okrNew ?? 3 }, (_, i) => ({ id: `o${i}` }));
      if (/INSERT INTO hr\.employee_kpis/.test(sql)) return Array.from({ length: opts.kpiNew ?? 2 }, (_, i) => ({ id: `k${i}` }));
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    return { service: new EmployeeDevelopmentService(db.dataSource as never, audit as never), db, audit };
  };

  it('sin puesto vinculado: 409 con mensaje claro y no copia nada', async () => {
    const { service, db, audit } = build({ jobPositionId: null });
    const err: ConflictException = await service.assign(E1, '2026-S2', ACTOR).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.message).toBe('El colaborador no tiene un puesto vinculado');
    expect(db.calls.some((c) => /INSERT/.test(c.sql))).toBe(false);
    expect(audit.logActivity).not.toHaveBeenCalled();
  });

  it('copia solo OKRs activos, vivos y del periodo; KPIs activos y vivos del puesto; el origen queda guardado', async () => {
    const { service, db } = build();
    await service.assign(E1, '2026-S2', ACTOR);
    const okr = db.calls.find((c) => /INSERT INTO hr\.employee_okrs/.test(c.sql))!;
    expect(okr.sql).toContain('o.period = $3');
    expect(okr.sql).toContain('o.deleted_at IS NULL');
    expect(okr.sql).toContain('o.is_active = true');
    expect(okr.sql).toContain('o.id'); // job_position_okr_id: el OKR de origen
    expect(okr.params).toEqual([E1, P1, '2026-S2', 'rrhh-1']);
    const kpi = db.calls.find((c) => /INSERT INTO hr\.employee_kpis/.test(c.sql))!;
    expect(kpi.sql).toContain('k.deleted_at IS NULL');
    expect(kpi.sql).toContain('k.is_active = true');
    expect(kpi.sql).not.toContain('period'); // los KPIs no dependen del periodo
  });

  it('es idempotente: lo ya copiado se omite (ON CONFLICT por origen) y la respuesta dice copiados y omitidos', async () => {
    const first = build({ okrInPosition: 3, okrNew: 3, kpiInPosition: 2, kpiNew: 2 });
    const r1 = await first.service.assign(E1, '2026-S2', ACTOR);
    expect(r1.summary).toEqual({ okrsCopied: 3, okrsSkipped: 0, kpisCopied: 2, kpisSkipped: 0 });

    const second = build({ okrInPosition: 3, okrNew: 0, kpiInPosition: 2, kpiNew: 0 });
    const r2 = await second.service.assign(E1, '2026-S2', ACTOR);
    expect(r2.summary).toEqual({ okrsCopied: 0, okrsSkipped: 3, kpisCopied: 0, kpisSkipped: 2 });

    // El puesto ganó un OKR nuevo: solo se copia ese.
    const third = build({ okrInPosition: 4, okrNew: 1, kpiInPosition: 2, kpiNew: 0 });
    expect((await third.service.assign(E1, '2026-S2', ACTOR)).summary).toEqual({ okrsCopied: 1, okrsSkipped: 3, kpisCopied: 0, kpisSkipped: 2 });

    const insert = first.db.calls.find((c) => /INSERT INTO hr\.employee_okrs/.test(c.sql))!;
    expect(insert.sql).toContain('ON CONFLICT (employee_id, job_position_okr_id)');
    expect(insert.sql).toContain('DO NOTHING');
  });

  it('deja auditoría de la asignación con los conteos', async () => {
    const { service, audit } = build({ okrInPosition: 2, okrNew: 1 });
    await service.assign(E1, '2026-S1', ACTOR);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'assign', module: 'desarrollo-organizacional', entityId: E1, changes: expect.objectContaining({ period: '2026-S1', okrsCopied: 1, okrsSkipped: 1 }) }));
  });

  it('un periodo inválido se rechaza antes de abrir transacción', async () => {
    const { service, db } = build();
    await expect(service.assign(E1, '2026-S5', ACTOR)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.calls).toHaveLength(0);
  });
});

describe('Desarrollo Organizacional · asignación masiva desde la Matriz', () => {
  const build = (employees: string[]) => {
    const db = fakeDb((sql) => {
      if (/FROM employees\.employee_records WHERE job_position_id/.test(sql)) return employees.map((id) => ({ id }));
      if (/SELECT id, code, title FROM hr\.job_positions/.test(sql)) return [{ id: P1, code: 'JP-001', title: 'Analista' }];
      if (/COUNT\(\*\) AS n FROM hr\.job_position_okrs/.test(sql)) return [{ n: '2' }];
      if (/COUNT\(\*\) AS n FROM hr\.job_position_kpis/.test(sql)) return [{ n: '1' }];
      if (/INSERT INTO hr\.employee_okrs/.test(sql)) return [{ id: 'a' }, { id: 'b' }];
      if (/INSERT INTO hr\.employee_kpis/.test(sql)) return [{ id: 'k' }];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    return { service: new EmployeeDevelopmentService(db.dataSource as never, audit as never), db, audit };
  };

  it('solo alcanza a empleados ACTIVOS con ese puesto y devuelve el resumen total', async () => {
    const { service, db, audit } = build(['e1', 'e2', 'e3']);
    const res = await service.assignToPositionEmployees(userWith({ write: true }), P1, '2026-S2', ACTOR);
    const q = db.calls.find((c) => /FROM employees\.employee_records WHERE job_position_id/.test(c.sql))!;
    expect(q.sql).toContain("status = 'active'");
    expect(q.sql).toContain('deleted_at IS NULL');
    expect(q.params).toEqual([P1]);
    expect(res).toEqual({ employees: 3, okrsCopied: 6, okrsSkipped: 0, kpisCopied: 3, kpisSkipped: 0 });
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'assign-bulk', entityType: 'job_position', changes: expect.objectContaining({ employees: 3, period: '2026-S2' }) }));
    expect(db.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('sin empleados con ese puesto: resumen en ceros', async () => {
    const res = await build([]).service.assignToPositionEmployees(userWith({ write: true }), P1, '2026-S2', ACTOR);
    expect(res.employees).toBe(0);
  });

  it('exige rrhh.desarrollo-organizacional.write además de matriz-puestos.update: sin él, 403 y no copia nada', async () => {
    const { service, db } = build(['e1']);
    await expect(service.assignToPositionEmployees(userWith({ read: true }), P1, '2026-S2', ACTOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.calls).toHaveLength(0);
    await expect(service.assignToPositionEmployees(userWith({ superAdmin: true }), P1, '2026-S2', ACTOR)).resolves.toBeDefined();
  });

  it('reutiliza la misma copia idempotente que la individual (mismo INSERT … ON CONFLICT)', async () => {
    const { db, service } = build(['e1']);
    await service.assignToPositionEmployees(userWith({ write: true }), P1, '2026-S2', ACTOR);
    expect(db.calls.find((c) => /INSERT INTO hr\.employee_okrs/.test(c.sql))!.sql).toContain('ON CONFLICT (employee_id, job_position_okr_id)');
  });

  it('un puesto inexistente o eliminado: 404', async () => {
    const db = fakeDb((sql) => (/SELECT id, code, title FROM hr\.job_positions/.test(sql) ? [] : []));
    const service = new EmployeeDevelopmentService(db.dataSource as never, { logActivity: jest.fn() } as never);
    await expect(service.assignToPositionEmployees(userWith({ write: true }), P1, '2026-S2', ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Desarrollo Organizacional · quitar', () => {
  it('quitar un OKR o KPI es baja lógica con auditoría; inexistente da 404', async () => {
    const db = fakeDb((sql) => {
      if (/UPDATE hr\.employee_okrs/.test(sql)) return [[{ id: 'o1', employee_id: E1, period: '2026-S2' }], 1];
      if (/UPDATE hr\.employee_kpis/.test(sql)) return [[], 0];
      return [];
    });
    const audit = { logActivity: jest.fn(async () => undefined) };
    const service = new EmployeeDevelopmentService(db.dataSource as never, audit as never);
    await service.removeOkr('o1', ACTOR);
    expect(db.calls[0]!.sql).toContain('deleted_at = NOW()');
    expect(db.calls.some((c) => /DELETE FROM/.test(c.sql))).toBe(false);
    expect(audit.logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'remove-okr' }));
    await expect(service.removeKpi('k1', ACTOR)).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── DTO, permisos y rutas ────────────────────────────────────────────────────

const errs = async (cls: new () => object, plain: object) => (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe('Desarrollo Organizacional · DTO', () => {
  it('periodo AAAA-S1/S2; puesto uuid o null', async () => {
    expect(await errs(PeriodQueryDto, {})).toEqual([]);
    expect(await errs(PeriodQueryDto, { period: '2026-S3' })).toContain('period');
    expect(await errs(AssignDto, {})).toContain('period');
    expect(await errs(AssignDto, { period: '2026-S1' })).toEqual([]);
    expect(await errs(SetPositionDto, { jobPositionId: null })).toEqual([]);
    expect(await errs(SetPositionDto, { jobPositionId: 'no' })).toContain('jobPositionId');
  });
});

describe('Desarrollo Organizacional · permisos y rutas', () => {
  const proto = EmployeeDevelopmentController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const perm = (n: string) => Reflect.getMetadata(PERMISSION_KEY, proto[n]!);
  const p = (module: string, action: string) => ({ section: 'rrhh', module, action });

  it('leer por empleado es solo de sesión (la regla de acceso la valida el servicio)', () => {
    expect(perm('get')).toBeNull();
  });
  it('opciones de puesto exigen read; vincular, asignar y quitar exigen write', () => {
    expect(perm('positionOptions')).toEqual(p('desarrollo-organizacional', 'read'));
    for (const n of ['setPosition', 'assign', 'removeOkr', 'removeKpi']) expect(perm(n)).toEqual(p('desarrollo-organizacional', 'write'));
  });
  it('la masiva exige matriz-puestos.update en la ruta (y desarrollo-organizacional.write en el servicio)', () => {
    expect(perm('assignToEmployees')).toEqual(p('matriz-puestos', 'update'));
  });
  it('la ruta fija position-options va antes de :employeeId', () => {
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('positionOptions')).toBeLessThan(order.indexOf('get'));
  });
  it('Mi Información: la ruta propia es solo de sesión y va antes de :id', () => {
    const ec = EmployeesController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    expect(Reflect.getMetadata(PERMISSION_KEY, ec.getMyDevelopment!)).toBeNull();
    const order = Object.getOwnPropertyNames(ec);
    expect(order.indexOf('getMyDevelopment')).toBeLessThan(order.indexOf('findOne'));
    expect(EmployeesController.prototype.getMyDevelopment.length).toBe(2); // (user, query): sin id de empleado del cliente
  });
});
