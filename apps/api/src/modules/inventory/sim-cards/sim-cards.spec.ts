import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { PERMISSION_KEY } from '../../auth/decorators/permission.decorator';
import {
  AssignSimCardDto,
  CreateSimCardDto,
  CreateSimPlanDto,
  QuerySimCardsDto,
  UpdateSimCardDto,
} from './dto/sim-card.dto';
import { SimCardsController } from './sim-cards.controller';
import { SimCardsService } from './sim-cards.service';
import {
  buildWarnings,
  daysUntil,
  effectiveCost,
  expiryStatus,
  normalizeIccid,
  normalizePhone,
} from './sim-cards.util';

const SIM_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const EMP_A = '33333333-3333-4333-8333-333333333333';
const EMP_B = '44444444-4444-4444-8444-444444444444';
const EQ_ID = '55555555-5555-4555-8555-555555555555';
const VENDOR_ID = '66666666-6666-4666-8666-666666666666';

const superAdmin = { id: 'u1', name: 'Leonardo', roles: [{ name: 'SUPER_ADMIN' }], userPermissions: [] } as any;
const withPerms = (...perms: [string, string, string][]) =>
  ({
    id: 'u2',
    name: 'Lector',
    roles: [{ name: 'DIRECTOR', permissions: perms.map(([section, module, action]) => ({ section, module, action })) }],
    userPermissions: [],
  }) as any;
const reader = withPerms(['transformacion', 'sim-cards', 'read']);
const rrhhReader = withPerms(['rrhh', 'empleados', 'read']);
const nobody = withPerms();

// ── Utilidades puras ─────────────────────────────────────────────────────────

describe('expiryStatus (semáforo, hora de México)', () => {
  // 15:00 UTC = 09:00 en México (UTC-6, sin horario de verano desde 2022).
  const now = new Date('2026-06-15T15:00:00Z');

  it('sin fecha → sin_fecha', () => {
    expect(expiryStatus(null, now)).toBe('sin_fecha');
    expect(expiryStatus(undefined, now)).toBe('sin_fecha');
    expect(expiryStatus('', now)).toBe('sin_fecha');
  });
  it('en el pasado → vencida', () => expect(expiryStatus('2026-06-14', now)).toBe('vencida'));
  it('hoy sigue por vencer, no vencida', () => expect(expiryStatus('2026-06-15', now)).toBe('por_vencer'));
  it('a 30 días → por_vencer; a 31 → vigente', () => {
    expect(expiryStatus('2026-07-15', now)).toBe('por_vencer');
    expect(expiryStatus('2026-07-16', now)).toBe('vigente');
  });
  it('usa el día de México, no el de UTC: 03:00 UTC del 16 todavía es 15 en México', () => {
    const lateNight = new Date('2026-06-16T03:00:00Z');
    expect(daysUntil('2026-06-15', lateNight)).toBe(0);
    expect(expiryStatus('2026-06-15', lateNight)).toBe('por_vencer');
  });
  it('fecha inválida → sin_fecha', () => expect(expiryStatus('no-es-fecha', now)).toBe('sin_fecha'));
});

describe('normalizePhone', () => {
  it.each([
    ['4771234567', '4771234567'],
    ['477 123 4567', '4771234567'],
    ['(477) 123-4567', '4771234567'],
    ['+52 477 123 4567', '4771234567'],
    ['+524771234567', '4771234567'],
    ['+52 1 477 123 4567', '4771234567'],
  ])('%s → %s', (raw, expected) => expect(normalizePhone(raw)).toBe(expected));

  it.each(['12345', '477123456', '47712345678', 'abc', ''])('rechaza %p', (raw) =>
    expect(() => normalizePhone(raw)).toThrow(BadRequestException),
  );
});

describe('normalizeIccid', () => {
  it('vacío o espacios → null', () => {
    expect(normalizeIccid('')).toBeNull();
    expect(normalizeIccid('  ')).toBeNull();
    expect(normalizeIccid(null)).toBeNull();
  });
  it('acepta de 18 a 22 dígitos y limpia espacios y guiones', () => {
    expect(normalizeIccid('8952 1400 0000 0000 001')).toBe('8952140000000000001');
  });
  it('rechaza letras o longitudes fuera de rango', () => {
    expect(() => normalizeIccid('1234')).toThrow(BadRequestException);
    expect(() => normalizeIccid('89521400000000000AB')).toThrow(BadRequestException);
  });
});

describe('effectiveCost', () => {
  it('sin costo propio hereda el del plan, con la moneda del plan', () => {
    expect(effectiveCost(null, 'MXN', 99, 'USD')).toEqual({ amount: 99, currency: 'USD' });
  });
  it('el costo propio manda, con su moneda (incluido el 0)', () => {
    expect(effectiveCost(150, 'MXN', 99, 'USD')).toEqual({ amount: 150, currency: 'MXN' });
    expect(effectiveCost(0, 'MXN', 99, 'USD')).toEqual({ amount: 0, currency: 'MXN' });
  });
});

describe('buildWarnings', () => {
  const base = {
    employeeId: EMP_A,
    employeeName: 'Ana',
    equipmentId: EQ_ID,
    equipmentDisplayId: 'TEC-2026-001',
    equipmentEmployeeId: EMP_A,
    equipmentEmployeeName: 'Ana',
  };
  it('sin aviso si coinciden, o si falta persona o equipo', () => {
    expect(buildWarnings(base)).toEqual([]);
    expect(buildWarnings({ ...base, equipmentId: null })).toEqual([]);
    expect(buildWarnings({ ...base, employeeId: null })).toEqual([]);
  });
  it('avisa (en español) si el equipo está asignado a otra persona', () => {
    const w = buildWarnings({ ...base, equipmentEmployeeId: EMP_B, equipmentEmployeeName: 'Beto' });
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('Ana');
    expect(w[0]).toContain('Beto');
    expect(w[0]).toContain('TEC-2026-001');
  });
  it('avisa si el equipo no tiene persona asignada', () => {
    const w = buildWarnings({ ...base, equipmentEmployeeId: null, equipmentEmployeeName: null });
    expect(w[0]).toContain('no tiene una persona asignada');
  });
});

// ── DTOs ─────────────────────────────────────────────────────────────────────

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const meta = (metatype: any): ArgumentMetadata => ({ type: 'body', metatype });
const validate = (dto: any, metatype: any) => pipe.transform(dto, meta(metatype));
const validateQuery = (dto: any) => pipe.transform(dto, { type: 'query', metatype: QuerySimCardsDto });

describe('DTOs', () => {
  const validCreate = { phoneNumber: '477 123 4567', planId: PLAN_ID };

  it('alta mínima válida', async () => {
    await expect(validate(validCreate, CreateSimCardDto)).resolves.toBeDefined();
  });
  it('rechaza un plan que no es UUID, estado o tipo inválidos y fechas imposibles', async () => {
    await expect(validate({ ...validCreate, planId: 'x' }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validCreate, status: 'sin_asignar' }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validCreate, deviceType: 'reloj' }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validCreate, contractEndDate: '2026-02-31' }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validCreate, contractEndDate: '31/12/2026' }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
  });
  it('rechaza costos negativos, plazo 0 y moneda desconocida', async () => {
    await expect(validate({ ...validCreate, monthlyCost: -1 }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validCreate, termMonths: 0 }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ ...validCreate, currency: 'EUR' }, CreateSimCardDto)).rejects.toThrow(BadRequestException);
  });
  it('PATCH no acepta persona, equipo ni fecha de asignación (solo assign/unassign)', async () => {
    await expect(validate({ employeeId: EMP_A }, UpdateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ equipmentId: EQ_ID }, UpdateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ assignedDate: '2026-01-01' }, UpdateSimCardDto)).rejects.toThrow(BadRequestException);
  });
  it('PATCH permite limpiar opcionales con null pero no el número ni el plan', async () => {
    const ok: any = await validate({ iccid: null, monthlyCost: null, termMonths: null, contractEndDate: null, notes: null }, UpdateSimCardDto);
    expect(ok.monthlyCost).toBeNull();
    await expect(validate({ phoneNumber: null }, UpdateSimCardDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ planId: null }, UpdateSimCardDto)).rejects.toThrow(BadRequestException);
  });
  it('el plan exige proveedor y costo no negativo', async () => {
    await expect(validate({ name: 'TEST-Plan 5GB', vendorId: VENDOR_ID, monthlyCost: 299 }, CreateSimPlanDto)).resolves.toBeDefined();
    await expect(validate({ name: '  ', vendorId: VENDOR_ID, monthlyCost: 299 }, CreateSimPlanDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ name: 'x', vendorId: 'no', monthlyCost: 299 }, CreateSimPlanDto)).rejects.toThrow(BadRequestException);
    await expect(validate({ name: 'x', vendorId: VENDOR_ID, monthlyCost: -5 }, CreateSimPlanDto)).rejects.toThrow(BadRequestException);
  });
  it('los filtros del listado se validan (unassigned llega como texto)', async () => {
    const q: any = await validateQuery({ unassigned: 'true', expiry: 'por_vencer', limit: '10' });
    expect(q.unassigned).toBe(true);
    expect(q.limit).toBe(10);
    await expect(validateQuery({ expiry: 'nunca' })).rejects.toThrow(BadRequestException);
    await expect(validateQuery({ status: 'sin_asignar' })).rejects.toThrow(BadRequestException);
  });
  it('assign no acepta campos ajenos', async () => {
    await expect(validate({ employeeId: EMP_A, status: 'activa' }, AssignSimCardDto)).rejects.toThrow(BadRequestException);
  });
});

// ── Permisos del controlador ─────────────────────────────────────────────────

describe('Permisos del controlador', () => {
  const proto = SimCardsController.prototype as any;
  const perm = (name: string) => Reflect.getMetadata(PERMISSION_KEY, proto[name]);

  it.each(['listPlans', 'stats', 'expiring', 'withoutEquipment', 'byEquipment', 'list', 'get'])(
    '%s pide transformacion.sim-cards.read',
    (name) => expect(perm(name)).toEqual({ section: 'transformacion', module: 'sim-cards', action: 'read' }),
  );
  it.each(['createPlan', 'updatePlan', 'deletePlan', 'create', 'update', 'assign', 'unassign', 'remove'])(
    '%s pide transformacion.sim-cards.write',
    (name) => expect(perm(name)).toEqual({ section: 'transformacion', module: 'sim-cards', action: 'write' }),
  );
  it('by-employee no usa el decorador (acepta sim-cards.read o rrhh.empleados.read en el servicio)', () => {
    expect(perm('byEmployee')).toBeUndefined();
  });
  it('las rutas fijas se declaran antes de :id', () => {
    const order = Object.getOwnPropertyNames(proto);
    const idx = (n: string) => order.indexOf(n);
    for (const fixed of ['listPlans', 'stats', 'expiring', 'byEmployee', 'byEquipment']) {
      expect(idx(fixed)).toBeLessThan(idx('get'));
    }
  });
});

// ── Servicio, con una base falsa guionada ────────────────────────────────────

function simRow(over: Record<string, unknown> = {}) {
  return {
    id: SIM_ID,
    sim_code: 'SIM-007',
    phone_number: '4771234567',
    iccid: '8952140000000000001',
    plan_id: PLAN_ID,
    plan_name: 'TEST-Plan 5GB',
    plan_cost: '299.00',
    plan_currency: 'MXN',
    provider_id: VENDOR_ID,
    provider_name: 'TEST-Proveedor',
    employee_id: null,
    employee_name: null,
    equipment_id: null,
    equipment_display_id: null,
    equipment_brand: null,
    equipment_model: null,
    equipment_employee_id: null,
    equipment_employee_name: null,
    monthly_cost: null,
    currency: 'MXN',
    term_months: 12,
    contract_end_date: '2030-01-31',
    activation_date: '2029-01-31',
    assigned_date: null,
    status: 'activa',
    device_type: 'smartphone',
    notes: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

interface Call {
  sql: string;
  params: unknown[];
}

function setup(initial: Record<string, unknown> = {}, opts: { failInsertWith?: unknown; planSims?: number } = {}) {
  const state = { row: simRow(initial) as Record<string, any> };
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (/nextval\('inventory\.sim_card_code_seq'\)/.test(sql)) return [{ n: '7' }];
    if (/FROM inventory\.sim_plans WHERE id/.test(sql) && /is_active/.test(sql)) {
      return [{ id: PLAN_ID, currency: 'USD', is_active: true }];
    }
    if (/FROM employees\.employee_records WHERE id/.test(sql)) return [{ '?column?': 1 }];
    if (/FROM inventory\.equipment WHERE id/.test(sql)) return [{ '?column?': 1 }];
    if (/FROM vendors\.vendors WHERE id/.test(sql)) return [{ '?column?': 1 }];
    if (/INSERT INTO inventory\.sim_cards/.test(sql)) {
      if (opts.failInsertWith) throw opts.failInsertWith;
      state.row = simRow({
        phone_number: params[1],
        employee_id: params[4],
        equipment_id: params[5],
        assigned_date: params[11],
      });
      return [{ id: SIM_ID }];
    }
    if (/FOR UPDATE/.test(sql)) return [{ id: SIM_ID }];
    if (/FROM inventory\.sim_card_history h/.test(sql)) return [];
    if (/SET employee_id = \$1, equipment_id = \$2, assigned_date = \$3/.test(sql)) {
      state.row = { ...state.row, employee_id: params[0], equipment_id: params[1], assigned_date: params[2] };
      return [];
    }
    if (/SET employee_id = NULL, equipment_id = NULL/.test(sql)) {
      state.row = { ...state.row, employee_id: null, equipment_id: null, assigned_date: null };
      return [];
    }
    if (/count\(\*\) FILTER/.test(sql)) return [{ activas: '3', sin_asignar: '1', por_vencer: '1', vencidas: '0', cost_mxn: '598.00', cost_usd: '10.50' }];
    if (/FROM inventory\.sim_cards s\s+JOIN inventory\.sim_plans p/.test(sql) || /s\.sim_code, s\.phone_number, s\.iccid/.test(sql)) {
      if (/count\(\*\) AS total/.test(sql)) return [{ total: '1' }];
      return [state.row];
    }
    if (/FROM inventory\.sim_plans p/.test(sql)) {
      return [
        {
          id: PLAN_ID,
          name: 'TEST-Plan 5GB',
          vendor_id: VENDOR_ID,
          vendor_name: 'TEST-Proveedor',
          monthly_cost: '299.00',
          currency: 'MXN',
          description: null,
          is_active: true,
          sim_count: String(opts.planSims ?? 0),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
    }
    return [];
  });
  const manager = { query };
  const dataSource = { manager, transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
  const service = new SimCardsService(dataSource as any);
  const historyInserts = () => calls.filter((c) => /INSERT INTO inventory\.sim_card_history/.test(c.sql));
  return { service, state, calls, dataSource, historyInserts };
}

describe('SimCardsService · alta', () => {
  it('el código sale de la secuencia, no de un COUNT', async () => {
    const { service, calls } = setup();
    await service.create({ phoneNumber: '477 123 4567', planId: PLAN_ID } as any, superAdmin);
    const insert = calls.find((c) => /INSERT INTO inventory\.sim_cards/.test(c.sql))!;
    expect(insert.params[0]).toBe('SIM-007');
    expect(calls.some((c) => /sim_card_code_seq/.test(c.sql))).toBe(true);
    expect(calls.some((c) => /count\(/i.test(c.sql))).toBe(false);
  });

  it('guarda el número normalizado y la moneda del plan por omisión', async () => {
    const { service, calls } = setup();
    await service.create({ phoneNumber: '+52 477 123 4567', planId: PLAN_ID } as any, superAdmin);
    const insert = calls.find((c) => /INSERT INTO inventory\.sim_cards/.test(c.sql))!;
    expect(insert.params[1]).toBe('4771234567');
    expect(insert.params[7]).toBe('USD');
  });

  it('un teléfono inválido se rechaza antes de tocar la base', async () => {
    const { service, dataSource } = setup();
    await expect(service.create({ phoneNumber: '123', planId: PLAN_ID } as any, superAdmin)).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('con persona y equipo iniciales escribe el historial en la misma transacción', async () => {
    const { service, historyInserts, dataSource } = setup();
    await service.create({ phoneNumber: '4771234567', planId: PLAN_ID, employeeId: EMP_A, equipmentId: EQ_ID } as any, superAdmin);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(historyInserts()).toHaveLength(1);
    expect(historyInserts()[0]!.params.slice(0, 4)).toEqual([SIM_ID, 'asignacion', EMP_A, EQ_ID]);
  });

  it('sin asignación inicial no escribe historial', async () => {
    const { service, historyInserts } = setup();
    await service.create({ phoneNumber: '4771234567', planId: PLAN_ID } as any, superAdmin);
    expect(historyInserts()).toHaveLength(0);
  });

  it('número duplicado → 409 con mensaje claro', async () => {
    const dup = { code: '23505', constraint: 'uq_sim_cards_phone_alive' };
    const { service } = setup({}, { failInsertWith: dup });
    await expect(service.create({ phoneNumber: '4771234567', planId: PLAN_ID } as any, superAdmin)).rejects.toThrow(
      new ConflictException('Ya existe una línea con ese número.'),
    );
  });

  it('ICCID duplicado → 409 (también si el error viene envuelto en driverError)', async () => {
    const dup = { driverError: { code: '23505', constraint: 'uq_sim_cards_iccid_alive' } };
    const { service } = setup({}, { failInsertWith: dup });
    await expect(
      service.create({ phoneNumber: '4771234567', planId: PLAN_ID, iccid: '8952140000000000001' } as any, superAdmin),
    ).rejects.toThrow(new ConflictException('Ya existe una línea con ese ICCID.'));
  });

  it('un error de base que no es de unicidad se propaga tal cual', async () => {
    const boom = new Error('boom');
    const { service } = setup({}, { failInsertWith: boom });
    await expect(service.create({ phoneNumber: '4771234567', planId: PLAN_ID } as any, superAdmin)).rejects.toBe(boom);
  });
});

describe('SimCardsService · edición', () => {
  it('actualiza solo los campos enviados y registra quién', async () => {
    const { service, calls } = setup();
    await service.update(SIM_ID, { notes: '  hola  ', termMonths: 24 } as any, superAdmin);
    const upd = calls.find((c) => /UPDATE inventory\.sim_cards SET notes|SET term_months|SET .*notes/.test(c.sql))!;
    expect(upd.sql).not.toMatch(/employee_id|equipment_id|assigned_date/);
    expect(upd.params).toContain('hola');
    expect(upd.params).toContain(24);
    expect(upd.params).toContain('u1');
  });

  it('PATCH vacío no ejecuta UPDATE', async () => {
    const { service, calls } = setup();
    await service.update(SIM_ID, {} as any, superAdmin);
    expect(calls.some((c) => /^\s*UPDATE inventory\.sim_cards/.test(c.sql))).toBe(false);
  });
});

describe('SimCardsService · asignación con historial', () => {
  it('assign exige persona o equipo', async () => {
    const { service } = setup();
    await expect(service.assign(SIM_ID, {} as any, superAdmin)).rejects.toThrow(BadRequestException);
  });

  it('asigna persona: actualiza la línea y deja un renglón con quién lo hizo', async () => {
    const { service, historyInserts, state, dataSource } = setup();
    const view = await service.assign(SIM_ID, { employeeId: EMP_A, assignedDate: '2026-03-01' }, superAdmin);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(state.row.employee_id).toBe(EMP_A);
    expect(state.row.assigned_date).toBe('2026-03-01');
    expect(view.employee?.id).toBe(EMP_A);
    const h = historyInserts();
    expect(h).toHaveLength(1);
    expect(h[0]!.params).toEqual([SIM_ID, 'asignacion', EMP_A, null, '2026-03-01', null, null, 'u1', 'Leonardo']);
  });

  it('reasignar a otra persona libera primero a la anterior y luego asigna', async () => {
    const { service, historyInserts } = setup({ employee_id: EMP_A, assigned_date: '2026-01-10' });
    await service.assign(SIM_ID, { employeeId: EMP_B }, superAdmin);
    const h = historyInserts();
    expect(h).toHaveLength(2);
    expect(h[0]!.params[1]).toBe('desasignacion');
    expect(h[0]!.params[2]).toBe(EMP_A);
    expect(h[1]!.params[1]).toBe('asignacion');
    expect(h[1]!.params[2]).toBe(EMP_B);
  });

  it('asignar solo el equipo conserva a la persona y su fecha', async () => {
    const { service, state } = setup({ employee_id: EMP_A, assigned_date: '2026-01-10' });
    await service.assign(SIM_ID, { equipmentId: EQ_ID }, superAdmin);
    expect(state.row.employee_id).toBe(EMP_A);
    expect(state.row.equipment_id).toBe(EQ_ID);
    expect(state.row.assigned_date).toBe('2026-01-10');
  });

  it('asignar lo mismo que ya tiene no escribe historial', async () => {
    const { service, historyInserts } = setup({ employee_id: EMP_A });
    await service.assign(SIM_ID, { employeeId: EMP_A }, superAdmin);
    expect(historyInserts()).toHaveLength(0);
  });

  it('una línea cancelada no se asigna', async () => {
    const { service } = setup({ status: 'cancelada' });
    await expect(service.assign(SIM_ID, { employeeId: EMP_A }, superAdmin)).rejects.toThrow(ConflictException);
  });

  it('unassign (todo) quita persona, equipo y fecha, y registra la liberación', async () => {
    const { service, state, historyInserts } = setup({ employee_id: EMP_A, equipment_id: EQ_ID, assigned_date: '2026-01-10' });
    await service.unassign(SIM_ID, { notes: 'Renuncia' }, superAdmin);
    expect(state.row.employee_id).toBeNull();
    expect(state.row.equipment_id).toBeNull();
    expect(state.row.assigned_date).toBeNull();
    const h = historyInserts();
    expect(h).toHaveLength(1);
    expect(h[0]!.params.slice(0, 4)).toEqual([SIM_ID, 'desasignacion', EMP_A, EQ_ID]);
    expect(h[0]!.params[6]).toBe('Renuncia');
    expect(h[0]!.params[8]).toBe('Leonardo');
  });

  it('unassign scope=equipment conserva a la persona', async () => {
    const { service, state, historyInserts } = setup({ employee_id: EMP_A, equipment_id: EQ_ID, assigned_date: '2026-01-10' });
    await service.unassign(SIM_ID, { scope: 'equipment' }, superAdmin);
    expect(state.row.employee_id).toBe(EMP_A);
    expect(state.row.assigned_date).toBe('2026-01-10');
    expect(state.row.equipment_id).toBeNull();
    expect(historyInserts()[0]!.params.slice(2, 4)).toEqual([null, EQ_ID]);
  });

  it('unassign de algo que no está asignado → 400 y sin historial', async () => {
    const { service, historyInserts } = setup();
    await expect(service.unassign(SIM_ID, {}, superAdmin)).rejects.toThrow(BadRequestException);
    expect(historyInserts()).toHaveLength(0);
  });
});

describe('SimCardsService · baja', () => {
  it('una línea asignada se desasigna (historial) y luego se marca deleted_at, nunca DELETE', async () => {
    const { service, calls, historyInserts } = setup({ employee_id: EMP_A, equipment_id: EQ_ID });
    await expect(service.remove(SIM_ID, superAdmin)).resolves.toEqual({ success: true });
    expect(historyInserts()).toHaveLength(1);
    expect(historyInserts()[0]!.params[1]).toBe('desasignacion');
    const historyIdx = calls.findIndex((c) => /INSERT INTO inventory\.sim_card_history/.test(c.sql));
    const deleteIdx = calls.findIndex((c) => /deleted_at = NOW\(\)/.test(c.sql));
    expect(historyIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeGreaterThan(historyIdx);
    expect(calls.some((c) => /DELETE FROM/i.test(c.sql))).toBe(false);
  });

  it('una línea sin asignar no deja historial', async () => {
    const { service, historyInserts } = setup();
    await service.remove(SIM_ID, superAdmin);
    expect(historyInserts()).toHaveLength(0);
  });
});

describe('SimCardsService · planes', () => {
  it('no se elimina un plan con líneas vivas (409) y sin tocar la base', async () => {
    const { service, calls } = setup({}, { planSims: 2 });
    await expect(service.deletePlan(PLAN_ID, superAdmin)).rejects.toThrow(ConflictException);
    expect(calls.some((c) => /deleted_at = NOW\(\)/.test(c.sql))).toBe(false);
  });

  it('un plan sin líneas se da de baja lógicamente', async () => {
    const { service, calls } = setup({}, { planSims: 0 });
    await expect(service.deletePlan(PLAN_ID, superAdmin)).resolves.toEqual({ success: true });
    expect(calls.some((c) => /UPDATE inventory\.sim_plans SET deleted_at = NOW\(\)/.test(c.sql))).toBe(true);
    expect(calls.some((c) => /DELETE FROM/i.test(c.sql))).toBe(false);
  });

  it('el nombre de plan repetido para el mismo proveedor → 409', async () => {
    const dup = { code: '23505', constraint: 'uq_sim_plans_vendor_name_alive' };
    const { service, dataSource } = setup();
    (dataSource.manager.query as jest.Mock).mockImplementationOnce(async () => [{ x: 1 }]).mockImplementationOnce(async () => {
      throw dup;
    });
    await expect(
      service.createPlan({ name: 'TEST-Plan 5GB', vendorId: VENDOR_ID, monthlyCost: 299 } as any, superAdmin),
    ).rejects.toThrow(ConflictException);
  });
});

describe('SimCardsService · lectura, ICCID y permisos', () => {
  it('el ICCID solo se devuelve con sim-cards.write', async () => {
    const { service } = setup();
    const withWrite = await service.get(SIM_ID, withPerms(['transformacion', 'sim-cards', 'write']));
    const readOnly = await service.get(SIM_ID, reader);
    expect(withWrite.iccid).toBe('8952140000000000001');
    expect('iccid' in readOnly).toBe(false);
    const list = await service.list({}, reader);
    expect('iccid' in list.data[0]!).toBe(false);
    const listAdmin = await service.list({}, superAdmin);
    expect(listAdmin.data[0]!.iccid).toBe('8952140000000000001');
  });

  it('by-employee acepta sim-cards.read o rrhh.empleados.read, y rechaza a quien no tiene ninguno', async () => {
    const { service } = setup();
    await expect(service.byEmployee(EMP_A, reader)).resolves.toBeDefined();
    await expect(service.byEmployee(EMP_A, rrhhReader)).resolves.toBeDefined();
    await expect(service.byEmployee(EMP_A, superAdmin)).resolves.toBeDefined();
    await expect(service.byEmployee(EMP_A, nobody)).rejects.toThrow(ForbiddenException);
  });

  it('by-employee con solo rrhh.empleados.read tampoco ve el ICCID', async () => {
    const { service } = setup({ employee_id: EMP_A });
    const res = await service.byEmployee(EMP_A, rrhhReader);
    expect(res.current).toHaveLength(1);
    expect('iccid' in res.current[0]!).toBe(false);
  });

  it('la línea hereda el costo y la moneda del plan si no tiene costo propio', async () => {
    const { service } = setup({ plan_cost: '299.00', plan_currency: 'USD', monthly_cost: null, currency: 'MXN' });
    const v = await service.get(SIM_ID, reader);
    expect(v.monthlyCost).toBe(299);
    expect(v.currency).toBe('USD');
    expect(v.ownMonthlyCost).toBeNull();
  });

  it('con costo propio manda el de la línea', async () => {
    const { service } = setup({ monthly_cost: '150.00', currency: 'MXN', plan_currency: 'USD' });
    const v = await service.get(SIM_ID, reader);
    expect(v.monthlyCost).toBe(150);
    expect(v.currency).toBe('MXN');
  });

  it('el proveedor se deriva del plan', async () => {
    const { service } = setup();
    const v = await service.get(SIM_ID, reader);
    expect(v.provider).toEqual({ id: VENDOR_ID, name: 'TEST-Proveedor' });
  });

  it('avisa (sin bloquear) si la persona de la línea no coincide con la del equipo', async () => {
    const { service } = setup({
      employee_id: EMP_A,
      employee_name: 'Ana',
      equipment_id: EQ_ID,
      equipment_display_id: 'TEC-2026-001',
      equipment_employee_id: EMP_B,
      equipment_employee_name: 'Beto',
    });
    const v = await service.get(SIM_ID, reader);
    expect(v.warnings).toHaveLength(1);
  });

  it('una línea inexistente → 404', async () => {
    const { service, dataSource } = setup();
    (dataSource.manager.query as jest.Mock).mockImplementation(async () => []);
    await expect(service.get(SIM_ID, reader)).rejects.toThrow(NotFoundException);
  });

  it('stats separa MXN y USD y no los suma', async () => {
    const { service } = setup();
    const s = await service.stats();
    expect(s).toEqual({ active: 3, unassigned: 1, expiring: 1, expired: 0, monthlyCostMXN: 598, monthlyCostUSD: 10.5 });
  });

  it('la búsqueda ignora acentos y mayúsculas y va parametrizada', async () => {
    const { service, calls } = setup();
    await service.list({ search: 'José' }, reader);
    const q = calls.find((c) => /LIKE/.test(c.sql) && /SELECT s\.id/.test(c.sql))!;
    expect(q.sql).toContain('translate(lower(');
    expect(q.params).toContain('%jose%');
    expect(q.sql).not.toContain('José');
  });

  it('un cursor mal formado se rechaza', async () => {
    const { service } = setup();
    await expect(service.list({ cursor: 'basura' }, reader)).rejects.toThrow(BadRequestException);
  });

  it('el filtro de vencimiento excluye líneas canceladas', async () => {
    const { service, calls } = setup();
    await service.list({ expiry: 'vencida' }, reader);
    const q = calls.find((c) => /SELECT s\.id/.test(c.sql))!;
    expect(q.sql).toContain(`s.status <> 'cancelada'`);
  });
});
