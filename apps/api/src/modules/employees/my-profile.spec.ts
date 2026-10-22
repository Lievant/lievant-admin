import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { SimCardsController } from '../inventory/sim-cards/sim-cards.controller';
import { SimCardsService } from '../inventory/sim-cards/sim-cards.service';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { EmployeesController } from './employees.controller';
import { MyProfileService } from './my-profile.service';
import { EMPLOYEE_NOT_LINKED, HIDDEN_DOCUMENT_TYPES, toMyProfile } from './my-profile.util';

const USER_A = 'user-a';
const USER_B = 'user-b';
const EMP_A = 'emp-a';
const EMP_B = 'emp-b';

function employeeRow(id: string, over: Record<string, unknown> = {}): any {
  return {
    id,
    displayId: `EMP-${id}`,
    codNom: '123',
    companyCode: 'TEST',
    companyName: 'TEST Lievant',
    division: 'Div',
    area: 'Área',
    project: null,
    level: 'N2',
    position: 'Analista',
    emailSignature: null,
    location: 'León',
    modality: 'hibrido',
    contractSchema: 'Nómina',
    fullName: `Nombre ${id}`,
    directReportTo: 'Jefe',
    corporateEmail: `${id}@lievant.com`,
    gender: 'F',
    nationality: 'Mexicana',
    seniorityDate: '2020-01-01',
    contractType: 'Indeterminado',
    contractEndDate: null,
    schedule: '9-6',
    lunchTime: '2-3',
    studies: 'Lic.',
    status: 'active',
    authUserId: id === EMP_A ? USER_A : USER_B,
    authUser: { id: 'x', passwordHash: 'SECRETO', email: 'x@lievant.com' },
    // Campos que NUNCA deben salir aunque la entidad los traiga:
    notes: 'nota interna de RRHH',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function personalRow(employeeId: string): any {
  return {
    id: 'p1',
    employeeId,
    rfc: 'RFC123456789',
    imssNumber: '1234',
    curp: 'CURP1234567890ABCD',
    birthDate: '1990-01-01',
    bloodType: 'O+',
    maritalStatus: 'Soltero',
    children: 0,
    phone: '4771234567',
    street: 'Calle',
    extNumber: '1',
    intNumber: null,
    neighborhood: 'Col',
    postalCode: '37000',
    city: 'León',
    state: 'Gto',
    mainTransport: 'Auto',
    commuteTime: '20 min',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function setup(over: { documents?: any[]; queryRows?: (sql: string) => unknown[] } = {}) {
  const employees = [employeeRow(EMP_A), employeeRow(EMP_B)];
  const docs = over.documents ?? [
    { id: 'doc-a1', employeeId: EMP_A, type: 'RFC', name: 'rfc.pdf', s3Key: 'k/a1', uploadedAt: new Date('2026-01-01'), uploadedBy: 'u' },
    { id: 'doc-b1', employeeId: EMP_B, type: 'CURP', name: 'curp.pdf', s3Key: 'k/b1', uploadedAt: new Date('2026-01-02'), uploadedBy: 'u' },
  ];
  const queries: { sql: string; params: unknown[] }[] = [];
  const employeesRepo = {
    findOne: jest.fn(async ({ where }: any) => employees.find((e) => e.authUserId === where.authUserId) ?? null),
    query: jest.fn(async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return over.queryRows?.(sql) ?? [];
    }),
  };
  const personalRepo = { findOne: jest.fn(async ({ where }: any) => (where.employeeId ? personalRow(where.employeeId) : null)) };
  const documentsRepo = {
    find: jest.fn(async ({ where }: any) => docs.filter((d) => d.employeeId === where.employeeId)),
    findOne: jest.fn(async ({ where }: any) => docs.find((d) => d.id === where.id && d.employeeId === where.employeeId) ?? null),
  };
  const storage = { getPresignedUrl: jest.fn(async (key: string) => `https://s3.example/${key}?sig=1`) };
  const service = new MyProfileService(employeesRepo as any, personalRepo as any, documentsRepo as any, storage as any);
  return { service, employeesRepo, personalRepo, documentsRepo, storage, queries };
}

// Llaves que delatarían remuneración u otros datos que el colaborador no debe ver.
const FORBIDDEN = /compensation|salary|salario|sueldo|gross|net_?estimate|bonus|voucher|notes|authUser|passwordHash|termination|deletedAt|authUserId/i;
const allKeys = (v: unknown, acc: string[] = []): string[] => {
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      acc.push(k);
      allKeys(val, acc);
    }
  }
  return acc;
};

describe('Mi Información · resolución por sesión', () => {
  it('el expediente sale del usuario de la sesión: A ve el suyo, B el suyo', async () => {
    const { service } = setup();
    expect((await service.getProfile(USER_A)).fullName).toBe(`Nombre ${EMP_A}`);
    expect((await service.getProfile(USER_B)).fullName).toBe(`Nombre ${EMP_B}`);
  });

  it('ningún método recibe un id de empleado: la firma solo admite usuario (y el documento propio)', () => {
    expect(MyProfileService.prototype.getProfile.length).toBe(1);
    expect(MyProfileService.prototype.listDocuments.length).toBe(1);
    expect(MyProfileService.prototype.getEquipment.length).toBe(1);
    expect(MyProfileService.prototype.getDocumentUrl.length).toBe(2);
  });

  it('sin vínculo → 404 con código EMPLOYEE_NOT_LINKED y el texto para RRHH', async () => {
    const { service } = setup();
    const err: any = await service.getProfile('user-sin-vinculo').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.getResponse()).toMatchObject({ statusCode: 404, code: EMPLOYEE_NOT_LINKED });
    expect(err.getResponse().message).toContain('rrhh@lievant.com');
    await expect(service.listDocuments('user-sin-vinculo')).rejects.toMatchObject({ status: 404 });
    await expect(service.getEquipment('user-sin-vinculo')).rejects.toMatchObject({ status: 404 });
  });
});

describe('Mi Información · lista blanca', () => {
  it('la respuesta no contiene remuneración ni otros campos prohibidos, aunque la entidad los traiga', async () => {
    const { service } = setup();
    const profile = await service.getProfile(USER_A);
    const keys = allKeys(profile);
    expect(keys.filter((k) => FORBIDDEN.test(k))).toEqual([]);
    expect(JSON.stringify(profile)).not.toMatch(/SECRETO|nota interna/);
  });

  it('solo trae las llaves previstas, ni una más', () => {
    const p = toMyProfile(employeeRow(EMP_A), personalRow(EMP_A));
    expect(Object.keys(p).sort()).toEqual(['fullName', 'laboral', 'personal']);
    expect(Object.keys(p.laboral).sort()).toEqual(
      [
        'displayId', 'codNom', 'status', 'position', 'level', 'project', 'companyName', 'companyCode', 'division', 'area',
        'directReportTo', 'location', 'modality', 'contractSchema', 'corporateEmail', 'emailSignature', 'seniorityDate',
        'contractType', 'contractEndDate', 'schedule', 'lunchTime', 'gender', 'nationality', 'studies',
      ].sort(),
    );
    expect(Object.keys(p.personal!).sort()).toEqual(
      ['rfc', 'curp', 'imssNumber', 'bloodType', 'birthDate', 'maritalStatus', 'children', 'phone', 'mainTransport', 'commuteTime', 'street', 'extNumber', 'intNumber', 'neighborhood', 'postalCode', 'city', 'state'].sort(),
    );
  });

  it('sin datos personales capturados, personal es null', () => {
    expect(toMyProfile(employeeRow(EMP_A), null).personal).toBeNull();
  });
});

describe('Mi Información · documentos', () => {
  it('lista solo los propios, sin llave de S3 ni URL', async () => {
    const { service } = setup();
    const docs = await service.listDocuments(USER_A);
    expect(docs.map((d) => d.id)).toEqual(['doc-a1']);
    expect(JSON.stringify(docs)).not.toMatch(/s3Key|k\/a1|https:/);
  });

  it('la URL prefirmada se da solo para un documento propio', async () => {
    const { service, storage } = setup();
    await expect(service.getDocumentUrl(USER_A, 'doc-a1')).resolves.toEqual({ url: 'https://s3.example/k/a1?sig=1' });
    expect(storage.getPresignedUrl).toHaveBeenCalledWith('k/a1');
  });

  it('el documento de otro colaborador responde 404 (no 403) y no se firma nada', async () => {
    const { service, storage } = setup();
    const err: any = await service.getDocumentUrl(USER_A, 'doc-b1').catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.getStatus()).toBe(404);
    await expect(service.getDocumentUrl(USER_A, 'no-existe')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('los tipos ocultos se configuran en una constante (hoy vacía: se ven todos)', () => {
    expect(HIDDEN_DOCUMENT_TYPES).toEqual([]);
  });
});

describe('Mi Información · equipos', () => {
  it('consulta solo por el empleado de la sesión, sin costos ni ICCID', async () => {
    const { service, queries } = setup({
      queryRows: (sql) =>
        /inventory\.equipment/.test(sql)
          ? [{ id: 'e1', display_id: 'TEC-1', legacy_id: null, equipment_type: 'Laptop', brand: 'Apple', model: 'M', status: 'Asignado' }]
          : [{ id: 't1', assignment_code: 'ASG-1', status: 'activo', tool_name: 'Slack' }],
    });
    const res = await service.getEquipment(USER_A);
    expect(queries.every((q) => q.params[0] === EMP_A)).toBe(true);
    expect(queries.every((q) => /deleted_at IS NULL/.test(q.sql))).toBe(true);
    expect(res.equipment[0]).toMatchObject({ displayId: 'TEC-1', equipmentType: 'Laptop' });
    expect(res.tools[0]).toEqual({ id: 't1', assignmentCode: 'ASG-1', status: 'activo', toolName: 'Slack' });
    expect(JSON.stringify(res)).not.toMatch(/cost|precio|iccid/i);
    expect(queries.map((q) => q.sql).join(' ')).not.toMatch(/unit_cost|cost/i);
  });
});

describe('Endpoints: solo sesión, sin escritura', () => {
  const proto = EmployeesController.prototype as any;
  it.each(['getMyProfile', 'getMyDocuments', 'getMyDocumentUrl', 'getMyEquipment'])('%s no exige permiso de RRHH', (name) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, proto[name])).toBeNull();
  });

  it('se declaran antes de :id', () => {
    const order = Object.getOwnPropertyNames(proto);
    for (const n of ['getMyProfile', 'getMyDocuments', 'getMyDocumentUrl', 'getMyEquipment']) {
      expect(order.indexOf(n)).toBeLessThan(order.indexOf('findOne'));
    }
  });

  it('Mi Información no agrega ninguna ruta de escritura para el colaborador', () => {
    const post = Object.getOwnPropertyNames(proto).filter((n) => /^getMy/.test(n) === false && /^(my|MyProfile)/i.test(n));
    expect(post).toEqual([]);
    for (const n of Object.getOwnPropertyNames(MyProfileService.prototype)) {
      expect(n).not.toMatch(/^(create|update|save|delete|remove|upload|set)/);
    }
  });

  it('vincular usuario exige rrhh.empleados.write (candidatos y vínculo)', () => {
    for (const n of ['getLinkUserCandidates', 'linkUser']) {
      expect(Reflect.getMetadata(PERMISSION_KEY, proto[n])).toEqual({ section: 'rrhh', module: 'empleados', action: 'write' });
    }
  });
});

// ── Mis líneas telefónicas ───────────────────────────────────────────────────

describe('GET /sim-cards/my-lines', () => {
  function simRow(code: string) {
    return {
      id: `id-${code}`, sim_code: code, phone_number: '4771234567', iccid: '8952140000000000001', plan_id: 'p',
      plan_name: 'Plan', plan_cost: '299', plan_currency: 'MXN', provider_id: 'v', provider_name: 'AT&T',
      employee_id: EMP_A, employee_name: 'Ana', equipment_id: null, equipment_display_id: null, equipment_brand: null,
      equipment_model: null, equipment_employee_id: null, equipment_employee_name: null, monthly_cost: null,
      currency: 'MXN', term_months: null, contract_end_date: null, activation_date: null, assigned_date: null,
      status: 'activa', device_type: 'smartphone', notes: null,
      created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'),
    };
  }

  it('consulta por el usuario de la sesión, solo líneas vivas, y nunca devuelve el ICCID', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const manager = { query: jest.fn(async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return [simRow('SIM-001')]; }) };
    const service = new SimCardsService({ manager, transaction: jest.fn() } as any);
    const lines = await service.myLines(USER_A);
    expect(calls[0]!.params).toEqual([USER_A]);
    expect(calls[0]!.sql).toContain('e.auth_user_id = $1');
    expect(calls[0]!.sql).toContain('s.deleted_at IS NULL');
    expect(JSON.stringify(lines)).not.toMatch(/iccid|8952140000000000001/i);
    expect(lines[0]!.simCode).toBe('SIM-001');
  });

  it('el endpoint no relaja sim-cards.read: no usa decorador y el empleado sale del JWT, no de un parámetro', () => {
    const proto = SimCardsController.prototype as any;
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.myLines)).toBeUndefined();
    expect(SimCardsController.prototype.myLines.length).toBe(1);
    // by-employee conserva su regla y los demás endpoints siguen exigiendo permiso
    expect(Reflect.getMetadata(PERMISSION_KEY, proto.list)).toEqual({ section: 'transformacion', module: 'sim-cards', action: 'read' });
    const order = Object.getOwnPropertyNames(proto);
    expect(order.indexOf('myLines')).toBeLessThan(order.indexOf('get'));
  });
});

// ── Vincular usuario ─────────────────────────────────────────────────────────

describe('Vincular usuario con expediente', () => {
  interface Opts {
    employee?: any | null;
    user?: any | null;
    takenBy?: string | null;
    candidates?: any[];
    failOn?: RegExp;
  }
  function setup(o: Opts = {}) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const employee = o.employee === undefined ? { id: 'e1', full_name: 'Ana Pérez', corporate_email: 'Ana.Perez@Lievant.com', auth_user_id: null } : o.employee;
    const user = o.user === undefined ? { id: 'u1', name: 'Ana', email: 'ana.perez@lievant.com', is_active: true } : o.user;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (o.failOn?.test(sql)) throw new Error('boom');
      if (/pg_advisory_xact_lock/.test(sql)) return [];
      if (/FROM employees\.employee_records\s+WHERE id/.test(sql)) return employee ? [employee] : [];
      if (/FROM auth\.users u\s+WHERE lower/.test(sql)) return o.candidates ?? [];
      if (/FROM auth\.users WHERE id/.test(sql)) return user ? [user] : [];
      if (/WHERE auth_user_id = \$1/.test(sql)) return o.takenBy ? [{ full_name: o.takenBy }] : [];
      return [];
    });
    const manager = { query };
    const dataSource = {
      query,
      transaction: jest.fn(async (cb: (m: any) => any) => cb(manager)),
    };
    return { service: new EmployeeUserLinkService(dataSource as any), queries, dataSource };
  }

  it('candidatos: mismo correo (sin distinguir mayúsculas), activos y sin otro expediente', async () => {
    const { service, queries } = setup({ candidates: [{ id: 'u1', name: 'Ana', email: 'ana.perez@lievant.com' }] });
    const res = await service.getCandidates('e1');
    expect(res).toHaveLength(1);
    const q = queries.find((x) => /FROM auth\.users u/.test(x.sql))!;
    expect(q.sql).toContain('lower(u.email) = lower($1)');
    expect(q.sql).toContain('u.is_active = true');
    expect(q.sql).toContain('u.deleted_at IS NULL');
    expect(q.sql).toContain('NOT EXISTS');
    expect(q.params).toEqual(['Ana.Perez@Lievant.com']);
  });

  it('un expediente ya vinculado no ofrece candidatos; sin correo corporativo tampoco', async () => {
    expect(await setup({ employee: { id: 'e1', full_name: 'X', corporate_email: 'a@lievant.com', auth_user_id: 'u9' } }).service.getCandidates('e1')).toEqual([]);
    expect(await setup({ employee: { id: 'e1', full_name: 'X', corporate_email: null, auth_user_id: null } }).service.getCandidates('e1')).toEqual([]);
  });

  it('un expediente inexistente o dado de baja → 404', async () => {
    await expect(setup({ employee: null }).service.getCandidates('e1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ employee: null }).service.link('e1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('vincula en una transacción: bloquea la fila, revalida y guarda auth_user_id', async () => {
    const { service, queries, dataSource } = setup();
    await expect(service.link('e1', 'u1')).resolves.toEqual({ id: 'e1', authUserId: 'u1' });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(queries.some((q) => /pg_advisory_xact_lock/.test(q.sql))).toBe(true);
    expect(queries.find((q) => /FROM employees\.employee_records\s+WHERE id/.test(q.sql))!.sql).toContain('FOR UPDATE');
    const update = queries.find((q) => /UPDATE employees\.employee_records SET auth_user_id/.test(q.sql))!;
    expect(update.params).toEqual(['u1', 'e1']);
  });

  it('el correo debe coincidir exactamente (ignorando mayúsculas); si no, se rechaza sin guardar', async () => {
    const { service, queries } = setup({ user: { id: 'u1', name: 'Otro', email: 'otra.persona@lievant.com', is_active: true } });
    await expect(service.link('e1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(queries.some((q) => /UPDATE employees.employee_records SET/.test(q.sql))).toBe(false);
  });

  it('un expediente ya vinculado se rechaza (409)', async () => {
    const { service, queries } = setup({ employee: { id: 'e1', full_name: 'Ana', corporate_email: 'ana.perez@lievant.com', auth_user_id: 'u9' } });
    await expect(service.link('e1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(queries.some((q) => /UPDATE employees.employee_records SET/.test(q.sql))).toBe(false);
  });

  it('un usuario ya vinculado a OTRO expediente se rechaza (409) y dice a cuál', async () => {
    const { service, queries } = setup({ takenBy: 'Beto Gómez' });
    await expect(service.link('e1', 'u1')).rejects.toThrow(/Beto Gómez/);
    expect(queries.some((q) => /UPDATE employees.employee_records SET/.test(q.sql))).toBe(false);
  });

  it('un usuario inexistente, inactivo o dado de baja se rechaza', async () => {
    await expect(setup({ user: null }).service.link('e1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ user: { id: 'u1', name: 'A', email: 'ana.perez@lievant.com', is_active: false } }).service.link('e1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un fallo a mitad de la transacción se propaga (la transacción hace rollback)', async () => {
    const { service } = setup({ failOn: /UPDATE employees\.employee_records SET auth_user_id/ });
    await expect(service.link('e1', 'u1')).rejects.toThrow('boom');
  });
});
