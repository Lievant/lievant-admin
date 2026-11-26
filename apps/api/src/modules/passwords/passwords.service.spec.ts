import 'reflect-metadata';
import { BadRequestException, ConflictException, ExecutionContext, ForbiddenException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { PasswordsController } from './passwords.controller';
import { APPLICATION_CREATE_LIMIT_PER_HOUR, PasswordsService, TRANSFER_LIMIT_PER_HOUR } from './passwords.service';
import { evaluatePasswordStrength, reusedPasswordWarning, WEAK_PASSWORD_WARNING } from './password-strength';
import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
// Lógica pura del formulario "Nueva cuenta" (frontend): se prueba aquí con el API real.
import {
  buildAccountPayload,
  resolveOwnerId,
  validateAccountForm,
} from '../../../../web/src/app/(dashboard)/herramientas/passwords/account-form';
import {
  buildTransferPayload,
  TRANSFER_WARNING,
  transferConfirmLabel,
  validateTransferForm,
} from '../../../../web/src/app/(dashboard)/herramientas/passwords/transfer-form';
import { CreateAccountPasswordDto, TransferAccountPasswordDto, UpdateAccountPasswordDto } from './dto/password.dto';

// Todos los ids son uuid-like; la jerarquía de las pruebas:
//   BOSS ── SUB1 (activo)
//        └─ SUB2 (inactivo)
//   BOSS ── (jefe de) ── JEFE_B ── NIETO   (NIETO es indirecto de BOSS)
//   PAR es par de BOSS (mismo jefe), ALIEN no tiene relación.
const BOSS = 'e-boss';
const SUB1 = 'e-sub1';
const SUB2_INACTIVE = 'e-sub2';
const JEFE_B = 'e-jefeb';
const NIETO = 'e-nieto';
const PAR = 'e-par';
const ALIEN = 'e-alien';

const employees: Record<string, { id: string; fullName: string; authUserId: string | null }> = {
  [BOSS]: { id: BOSS, fullName: 'Jefa Ejemplo', authUserId: 'u-boss' },
  [SUB1]: { id: SUB1, fullName: 'Ana Subordinada', authUserId: 'u-sub1' },
  [SUB2_INACTIVE]: { id: SUB2_INACTIVE, fullName: 'Baja Inactiva', authUserId: 'u-sub2' },
  [JEFE_B]: { id: JEFE_B, fullName: 'Jefe Intermedio', authUserId: 'u-jefeb' },
  [NIETO]: { id: NIETO, fullName: 'Nieto Indirecto', authUserId: 'u-nieto' },
  [PAR]: { id: PAR, fullName: 'Par Ejemplo', authUserId: 'u-par' },
  [ALIEN]: { id: ALIEN, fullName: 'Ajena Total', authUserId: 'u-alien' },
};

/** Subordinados directos ACTIVOS por jefe (los inactivos no entran: teamQuery los excluye). */
const activeTeam: Record<string, string[]> = {
  [BOSS]: [SUB1, JEFE_B],
  [JEFE_B]: [NIETO],
};

const userOf = (id: string, superAdmin = false) =>
  ({ id, email: `${id}@lievant.com`, roles: superAdmin ? [{ name: 'SUPER_ADMIN' }] : [] }) as any;

/** Cadena mínima de QueryBuilder: resuelve según el jefe y el empleado preguntados. */
function fakeQueryBuilder(managerId: string) {
  const state: { employeeId?: string } = {};
  const qb: any = {
    where: () => qb,
    andWhere: (_sql: string, params?: { employeeId?: string }) => {
      if (params?.employeeId) state.employeeId = params.employeeId;
      return qb;
    },
    orderBy: () => qb,
    getCount: async () => (state.employeeId && activeTeam[managerId]?.includes(state.employeeId) ? 1 : 0),
    getMany: async () => (activeTeam[managerId] ?? []).map((id) => employees[id]),
  };
  return qb;
}

function build(
  opts: {
    accountRows?: Record<string, unknown>[];
    revealRow?: Record<string, unknown>;
    revealCount?: number;
    reusedIn?: string[];
  } = {},
) {
  const dbCalls: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      dbCalls.push({ sql, params });
      if (sql.includes('FROM passwords.account_passwords ap\n      JOIN passwords.applications')) {
        return opts.accountRows ?? [];
      }
      if (sql.includes('e.direct_report_to_id AS employee_manager_id')) return opts.revealRow ? [opts.revealRow] : [];
      if (sql.includes('INSERT INTO passwords.account_passwords')) return [{ id: 'nueva-cuenta' }];
      if (sql.includes('FROM passwords.reveal_log')) return [{ count: opts.revealCount ?? 0 }];
      if (sql.includes('AS reused_in')) return (opts.reusedIn ?? []).map((reused_in) => ({ reused_in }));
      if (sql.includes('pgp_sym_decrypt')) return [{ password: 'secreto-de-prueba' }];
      return [];
    }),
  };
  const employeesRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      Object.values(employees).find((e) => e.authUserId === where.authUserId) ?? null,
    ),
    createQueryBuilder: jest.fn(() => {
      // El jefe consultado sale del último `findOne` resuelto: se fija con setManager().
      return fakeQueryBuilder(currentManager);
    }),
  };
  let currentManager = BOSS;
  const origFind = employeesRepo.findOne;
  employeesRepo.findOne = jest.fn(async (arg: any) => {
    const found = await origFind(arg);
    if (found) currentManager = found.id;
    return found;
  });

  const config = { get: () => 'k'.repeat(40) };
  const audit = { logSecurity: jest.fn(async () => undefined) };
  const service = new PasswordsService(
    db as any,
    { exists: jest.fn(async () => true) } as any,
    employeesRepo as any,
    config as any,
    audit as any,
    {} as any,
    {} as any,
  );
  return { service, db, dbCalls, audit };
}

const accountRow = (employeeId: string) => ({
  id: 'a1',
  record_number: 1,
  username: 'ana@x.com',
  assigned_date: '2026-01-01',
  expiry_date: null,
  status: 'activa',
  notes: null,
  manager_id: BOSS,
  manager_name: 'Jefa Ejemplo',
  application_id: 'app',
  application_name: 'M365',
  application_category: null,
  employee_id: employeeId,
  employee_name: employees[employeeId]!.fullName,
  employee_area: 'X',
  employee_position: 'Y',
});

describe('PasswordsService.getVisiblePeople', () => {
  it('devuelve la propia persona y sus subordinados directos activos, solo id, nombre y isMe', async () => {
    const { service } = build();
    expect(await service.getVisiblePeople('u-boss')).toEqual([
      { id: BOSS, fullName: 'Jefa Ejemplo', isMe: true },
      { id: SUB1, fullName: 'Ana Subordinada', isMe: false },
      { id: JEFE_B, fullName: 'Jefe Intermedio', isMe: false },
    ]);
  });

  it('un colaborador sin equipo solo se ve a sí mismo', async () => {
    const { service } = build();
    expect(await service.getVisiblePeople('u-sub1')).toEqual([
      { id: SUB1, fullName: 'Ana Subordinada', isMe: true },
    ]);
  });

  it('un subordinado inactivo no aparece', async () => {
    const { service } = build();
    const people = await service.getVisiblePeople('u-boss');
    expect(people.map((p) => p.id)).not.toContain(SUB2_INACTIVE);
  });

  it('un usuario sin registro de empleado recibe una lista vacía', async () => {
    const { service } = build();
    expect(await service.getVisiblePeople('u-sin-expediente')).toEqual([]);
  });
});

describe('PasswordsService.list (alcance)', () => {
  it('un colaborador sin id obtiene sus propias cuentas', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(SUB1)] });
    const res = await service.list(userOf('u-sub1'), {});
    expect(res).toHaveLength(1);
    expect(dbCalls[0]?.params[0]).toBe(SUB1);
  });

  it('un colaborador que manda a mano el id de otra persona recibe 403', async () => {
    const { service, db } = build({ accountRows: [accountRow(ALIEN)] });
    await expect(service.list(userOf('u-sub1'), { employeeId: ALIEN })).rejects.toThrow(ForbiddenException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('un jefe pide un subordinado directo activo: OK', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(SUB1)] });
    await expect(service.list(userOf('u-boss'), { employeeId: SUB1 })).resolves.toHaveLength(1);
    expect(dbCalls[0]?.params[0]).toBe(SUB1);
  });

  it('un jefe pide a un subordinado indirecto: 403', async () => {
    const { service } = build();
    await expect(service.list(userOf('u-boss'), { employeeId: NIETO })).rejects.toThrow(ForbiddenException);
  });

  it('un jefe pide a un par: 403', async () => {
    const { service } = build();
    await expect(service.list(userOf('u-boss'), { employeeId: PAR })).rejects.toThrow(ForbiddenException);
  });

  it('un jefe pide a un subordinado inactivo: 403', async () => {
    const { service } = build();
    await expect(service.list(userOf('u-boss'), { employeeId: SUB2_INACTIVE })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('el 403 es genérico y no revela si la persona existe', async () => {
    const { service } = build();
    const existente = await service.list(userOf('u-sub1'), { employeeId: ALIEN }).catch((e) => e.message);
    const inexistente = await service.list(userOf('u-sub1'), { employeeId: 'no-existe' }).catch((e) => e.message);
    expect(existente).toBe(inexistente);
  });

  it('un usuario sin registro de empleado recibe una lista vacía, sin error', async () => {
    const { service } = build();
    await expect(service.list(userOf('u-sin-expediente'), {})).resolves.toEqual([]);
  });

  it('SUPER_ADMIN tampoco amplía el alcance del listado', async () => {
    const { service } = build();
    await expect(service.list(userOf('u-sub1', true), { employeeId: ALIEN })).rejects.toThrow(ForbiddenException);
  });

  it('nunca selecciona la contraseña cifrada', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(SUB1)] });
    await service.list(userOf('u-sub1'), {});
    expect(dbCalls[0]?.sql).not.toContain('password_encrypted');
  });
});

describe('PasswordsService.reveal (alcance)', () => {
  const revealRow = (employeeId: string, over: Record<string, unknown> = {}) => ({
    id: 'a1',
    manager_id: BOSS,
    employee_id: employeeId,
    deleted_at: null,
    expiry_date: null,
    employee_manager_id: null,
    ...over,
  });

  it('la propia persona puede revelar su cuenta (con bitácora)', async () => {
    const { service, audit, dbCalls } = build({ revealRow: revealRow(SUB1) });
    await expect(service.reveal(userOf('u-sub1'), 'a1', 'ver', '1.2.3.4')).resolves.toEqual({
      password: 'secreto-de-prueba',
    });
    expect(dbCalls.some((c) => c.sql.includes('INSERT INTO passwords.reveal_log'))).toBe(true);
    expect(audit.logSecurity).toHaveBeenCalled();
  });

  it('un jefe puede revelar la cuenta de un subordinado directo activo', async () => {
    const { service } = build({ revealRow: revealRow(SUB1) });
    await expect(service.reveal(userOf('u-boss'), 'a1', 'copiar', null)).resolves.toBeDefined();
  });

  it('un colaborador no puede revelar la cuenta de otra persona', async () => {
    const { service, dbCalls } = build({ revealRow: revealRow(ALIEN) });
    await expect(service.reveal(userOf('u-sub1'), 'a1', 'ver', null)).rejects.toThrow(ForbiddenException);
    expect(dbCalls.some((c) => c.sql.includes('pgp_sym_decrypt'))).toBe(false);
  });

  it('un jefe no puede revelar la de un indirecto, un par ni un inactivo', async () => {
    for (const target of [NIETO, PAR, SUB2_INACTIVE]) {
      const { service } = build({ revealRow: revealRow(target) });
      await expect(service.reveal(userOf('u-boss'), 'a1', 'ver', null)).rejects.toThrow(ForbiddenException);
    }
  });

  it('el líder que la asignó pero ya no es jefe de la persona ya no puede revelarla', async () => {
    const { service } = build({ revealRow: revealRow(PAR, { manager_id: BOSS }) });
    await expect(service.reveal(userOf('u-boss'), 'a1', 'ver', null)).rejects.toThrow(ForbiddenException);
  });
});

const createDto = (employeeId: string) =>
  ({ applicationId: 'app', employeeId, username: 'ana@x.com', password: 'Clave-de-prueba-1' }) as any;

describe('PasswordsService.create (alcance)', () => {
  const row = (employeeId: string) => [accountRow(employeeId)];

  it('una persona crea una cuenta para sí misma', async () => {
    const { service, dbCalls } = build({ accountRows: row(SUB1) });
    await expect(service.create(userOf('u-sub1'), createDto(SUB1))).resolves.toBeDefined();
    const insert = dbCalls.find((c) => c.sql.includes('INSERT INTO passwords.account_passwords'))!;
    expect(insert.params[1]).toBe(SUB1); // titular
    expect(insert.params[2]).toBe(SUB1); // quien la asigna: ella misma
  });

  it('un jefe crea la cuenta de un subordinado directo activo', async () => {
    const { service, dbCalls } = build({ accountRows: row(SUB1) });
    await service.create(userOf('u-boss'), createDto(SUB1));
    const insert = dbCalls.find((c) => c.sql.includes('INSERT INTO passwords.account_passwords'))!;
    expect(insert.params[1]).toBe(SUB1);
    expect(insert.params[2]).toBe(BOSS);
  });

  it('una persona que manda a mano el id de otra recibe 403 y no se escribe nada', async () => {
    const { service, db } = build();
    await expect(service.create(userOf('u-sub1'), createDto(ALIEN))).rejects.toThrow(ForbiddenException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each([NIETO, PAR, SUB2_INACTIVE, ALIEN])('un jefe no puede crear para %s (indirecto, par, inactivo o ajeno)', async (target) => {
    const { service } = build();
    await expect(service.create(userOf('u-boss'), createDto(target))).rejects.toThrow(ForbiddenException);
  });

  it('un usuario sin expediente recibe 403 claro, sin error técnico', async () => {
    const { service } = build();
    const err = await service.create(userOf('u-sin-expediente'), createDto(SUB1)).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.message).toMatch(/expediente de empleado/);
  });

  it('SUPER_ADMIN tampoco gana acceso por rol sobre otra persona', async () => {
    const { service } = build();
    await expect(service.create(userOf('u-alien', true), createDto(SUB1))).rejects.toThrow(ForbiddenException);
  });
});

describe('PasswordsService.update y revoke (alcance)', () => {
  const access = (employeeId: string, over: Record<string, unknown> = {}) => ({
    id: 'a1',
    manager_id: BOSS,
    employee_id: employeeId,
    deleted_at: null,
    expiry_date: null,
    employee_manager_id: null,
    ...over,
  });

  it('una persona edita y revoca su propia cuenta', async () => {
    const { service } = build({ revealRow: access(SUB1), accountRows: [accountRow(SUB1)] });
    await expect(service.update(userOf('u-sub1'), 'a1', { username: 'nuevo@x.com' } as any)).resolves.toBeDefined();
    await expect(service.revoke(userOf('u-sub1'), 'a1')).resolves.toBeUndefined();
  });

  it('una persona no puede editar ni revocar la cuenta de otra', async () => {
    const { service } = build({ revealRow: access(ALIEN) });
    await expect(service.update(userOf('u-sub1'), 'a1', { username: 'x' } as any)).rejects.toThrow(ForbiddenException);
    await expect(service.revoke(userOf('u-sub1'), 'a1')).rejects.toThrow(ForbiddenException);
  });

  it('un jefe edita y revoca la de un subordinado directo activo', async () => {
    const { service } = build({ revealRow: access(SUB1), accountRows: [accountRow(SUB1)] });
    await expect(service.update(userOf('u-boss'), 'a1', { username: 'n@x.com' } as any)).resolves.toBeDefined();
    await expect(service.revoke(userOf('u-boss'), 'a1')).resolves.toBeUndefined();
  });

  it.each([NIETO, PAR, SUB2_INACTIVE])('un jefe no puede editar ni revocar la de %s', async (target) => {
    const { service } = build({ revealRow: access(target) });
    await expect(service.update(userOf('u-boss'), 'a1', { username: 'x' } as any)).rejects.toThrow(ForbiddenException);
    await expect(service.revoke(userOf('u-boss'), 'a1')).rejects.toThrow(ForbiddenException);
  });

  it('el líder que asignó la cuenta pero ya no es jefe pierde el acceso', async () => {
    const { service } = build({ revealRow: access(PAR, { manager_id: BOSS }) });
    await expect(service.update(userOf('u-boss'), 'a1', { username: 'x' } as any)).rejects.toThrow(ForbiddenException);
  });

  it('no se puede pasar la cuenta propia a una persona fuera del alcance', async () => {
    const { service } = build({ revealRow: access(SUB1) });
    await expect(service.update(userOf('u-sub1'), 'a1', { employeeId: ALIEN } as any)).rejects.toThrow(ForbiddenException);
  });

  it('un usuario sin expediente recibe 403 al editar o revocar', async () => {
    const { service } = build({ revealRow: access(SUB1) });
    await expect(service.update(userOf('u-sin-expediente'), 'a1', { username: 'x' } as any)).rejects.toThrow(ForbiddenException);
    await expect(service.revoke(userOf('u-sin-expediente'), 'a1')).rejects.toThrow(ForbiddenException);
  });
});

describe('PasswordsService.reveal (tope, bitácora y secretos)', () => {
  const own = {
    id: 'a1',
    manager_id: BOSS,
    employee_id: SUB1,
    deleted_at: null,
    expiry_date: null,
    employee_manager_id: BOSS,
  };

  it('aplica el tope de 10 por hora también a las cuentas propias', async () => {
    const { service } = build({ revealRow: own, revealCount: 10 });
    await expect(service.reveal(userOf('u-sub1'), 'a1', 'ver', null)).rejects.toMatchObject({ status: 429 });
  });

  it('registra actor y titular, tanto al revelar la propia como al revelar la de un subordinado', async () => {
    for (const [actorUser, actorId] of [
      ['u-sub1', 'u-sub1'],
      ['u-boss', 'u-boss'],
    ] as const) {
      const { service, audit, dbCalls } = build({ revealRow: own });
      await service.reveal(userOf(actorUser), 'a1', 'copiar', '10.0.0.1');
      const log = dbCalls.find((c) => c.sql.includes('INSERT INTO passwords.reveal_log'))!;
      expect(log.params[1]).toBe(actorId); // actor
      expect(log.params[0]).toBe('a1'); // la cuenta, cuyo titular es el empleado SUB1
      expect(audit.logSecurity).toHaveBeenCalledWith(
        expect.objectContaining({ userId: actorId, details: { action: 'copiar', employeeId: SUB1 } }),
      );
    }
  });

  it('ni la bitácora de seguridad ni la del módulo contienen la contraseña', async () => {
    const { service, audit, dbCalls } = build({ revealRow: own });
    await service.reveal(userOf('u-sub1'), 'a1', 'ver', null);
    const rastro = JSON.stringify([audit.logSecurity.mock.calls, dbCalls.filter((c) => !c.sql.includes('pgp_sym_decrypt'))]);
    expect(rastro).not.toContain('secreto-de-prueba');
  });
});

describe('PasswordsController (permisos y exportación)', () => {
  const required = (m: keyof PasswordsController) =>
    Reflect.getMetadata(PERMISSION_KEY, PasswordsController.prototype[m]);

  it.each([
    'list',
    'reveal',
    'create',
    'update',
    'revoke',
    'getVisiblePeople',
    'isManager',
    'getTeamEmployees',
    'listApplications',
    'createApplication',
    'transfer',
    'listTransfers',
    'searchTransferCandidates',
  ] as const)('%s no exige permiso: el alcance lo fija el servicio', (m) => {
    expect(required(m)).toBeUndefined();
  });

  it.each(['updateApplication', 'deactivateApplication'] as const)(
    '%s (catálogo) conserva herramientas.passwords.write',
    (m) => {
      expect(required(m)).toEqual({ section: 'herramientas', module: 'passwords', action: 'write' });
    },
  );

  it('ya no existe un endpoint para exportar a Excel', () => {
    const methods = Object.getOwnPropertyNames(PasswordsController.prototype);
    expect(methods.filter((m) => /export|excel|xlsx/i.test(m))).toEqual([]);
  });
});

describe('Formulario "Nueva cuenta" → API', () => {
  const people = [
    { id: BOSS, isMe: true },
    { id: SUB1, isMe: false },
  ];
  const base = {
    isEdit: false,
    applicationId: '0db5a2f5-865b-47e5-a9b3-512efe50c627',
    people,
    username: 'cuenta@cliente.com',
    password: 'Clave-de-prueba-1',
    assignedDate: '2026-10-15',
    expiryDate: '',
    notes: '',
  };
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'body', metatype: CreateAccountPasswordDto };

  // Los ids del servicio de prueba no son UUID; para el DTO se usan los reales de las pruebas.
  const UUID_ME = 'e462ac26-5a51-41dc-b781-93cecef73e27';
  const UUID_SUB = 'cb1ba3e6-c74b-4645-a2e9-637a86d294e5';

  it('con "Yo" preseleccionado el formulario es válido y envía el titular propio', () => {
    const form = { ...base, employeeId: BOSS };
    expect(validateAccountForm(form)).toBeNull();
    const payload = buildAccountPayload(form);
    expect(payload.employeeId).toBe(BOSS);
    expect(payload).toMatchObject({ expiryDate: null, notes: null, username: 'cuenta@cliente.com' });
  });

  it('el cuerpo del formulario (con expiryDate y notes en null) pasa la validación del API', async () => {
    const form = { ...base, people: [{ id: UUID_ME, isMe: true }, { id: UUID_SUB, isMe: false }], employeeId: UUID_ME };
    const body = buildAccountPayload(form);
    await expect(pipe.transform(body, meta)).resolves.toBeDefined();
  });

  it('un titular vacío o desfasado se resuelve a la propia persona, no a un valor en blanco', () => {
    for (const stale of ['', 'e-borrado', 'id-de-un-ajeno']) {
      const form = { ...base, employeeId: stale };
      expect(resolveOwnerId(people, stale)).toBe(BOSS);
      expect(validateAccountForm(form)).toBeNull();
      expect(buildAccountPayload(form).employeeId).toBe(BOSS);
    }
  });

  it('para un subordinado envía el titular del subordinado', () => {
    const payload = buildAccountPayload({ ...base, employeeId: SUB1 });
    expect(payload.employeeId).toBe(SUB1);
  });

  it('nunca envía un titular que no esté entre las personas visibles', () => {
    expect(buildAccountPayload({ ...base, employeeId: ALIEN }).employeeId).toBe(BOSS);
  });

  it('sin personas visibles (sin expediente) no se puede guardar y lo dice', () => {
    expect(validateAccountForm({ ...base, people: [], employeeId: '' })).toBe(
      'No se pudo determinar de quién es la cuenta.',
    );
  });

  it('al editar no se pide ni se envía el titular', () => {
    const form = { ...base, isEdit: true, people: [], employeeId: '', password: '' };
    expect(validateAccountForm(form)).toBeNull();
    expect(buildAccountPayload(form)).not.toHaveProperty('employeeId');
    expect(buildAccountPayload(form)).not.toHaveProperty('password');
  });

  it.each([
    [{ applicationId: '' }, 'Selecciona la aplicación.'],
    [{ username: '   ' }, 'Escribe el usuario o correo.'],
    [{ username: 'x'.repeat(501) }, 'El usuario o correo no puede pasar de 500 caracteres.'],
    [{ password: '' }, 'Escribe o genera la contraseña.'],
    [{ expiryDate: '2026-01-01' }, 'El vencimiento no puede ser anterior a la fecha de asignación.'],
  ])('mensajes de validación: %p', (override, message) => {
    expect(validateAccountForm({ ...base, employeeId: BOSS, ...override })).toBe(message);
  });

  it('el usuario acepta texto libre (nickname, sin arroba) y se guarda tal cual, solo recortado', () => {
    for (const username of ['sin-arroba', 'Juan.Perez_MX', '@marca', 'cuenta@cliente.com']) {
      expect(validateAccountForm({ ...base, employeeId: BOSS, username })).toBeNull();
    }
    expect(buildAccountPayload({ ...base, employeeId: BOSS, username: '  NickName_01  ' }).username).toBe('NickName_01');
  });

  describe('DTO del API: usuario de texto libre', () => {
    const body = (username: unknown) => ({
      applicationId: '0db5a2f5-865b-47e5-a9b3-512efe50c627',
      employeeId: UUID_ME,
      username,
      password: 'Clave-de-prueba-1',
    });
    const updateMeta: ArgumentMetadata = { type: 'body', metatype: UpdateAccountPasswordDto };

    it.each(['sin-arroba', 'Juan.Perez_MX', '=SUMA(A1)', 'x'.repeat(500)])('acepta %p al crear y al editar', async (username) => {
      await expect(pipe.transform(body(username), meta)).resolves.toBeDefined();
      await expect(pipe.transform({ username }, updateMeta)).resolves.toBeDefined();
    });

    it('recorta espacios pero conserva mayúsculas y caracteres tal cual', async () => {
      const dto = await pipe.transform(body('  MiUsuario.ÑANDÚ  '), meta);
      expect(dto.username).toBe('MiUsuario.ÑANDÚ');
    });

    it.each([['', 'vacío'], ['   ', 'solo espacios'], ['x'.repeat(501), '501 caracteres'], [123, 'no texto']])(
      'rechaza %p (%s) con 400 al crear y al editar',
      async (username: unknown, _label: string) => {
        await expect(pipe.transform(body(username), meta)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
        await expect(pipe.transform({ username }, updateMeta)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      },
    );

    it('falta el usuario al crear: 400', async () => {
      const { username: _omit, ...rest } = body('x');
      await expect(pipe.transform(rest, meta)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });
  });

  it('end to end: el cuerpo del formulario con "Yo" crea la cuenta propia en el servicio', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(BOSS)] });
    const body = buildAccountPayload({ ...base, employeeId: BOSS }) as any;
    await expect(service.create(userOf('u-boss'), body)).resolves.toBeDefined();
    const insert = dbCalls.find((c) => c.sql.includes('INSERT INTO passwords.account_passwords'))!;
    expect(insert.params[1]).toBe(BOSS); // titular: la propia persona
    expect(insert.params[2]).toBe(BOSS); // quien la asigna
  });

  it('end to end: el cuerpo del formulario para un subordinado crea la cuenta del subordinado', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(SUB1)] });
    const body = buildAccountPayload({ ...base, employeeId: SUB1 }) as any;
    await expect(service.create(userOf('u-boss'), body)).resolves.toBeDefined();
    const insert = dbCalls.find((c) => c.sql.includes('INSERT INTO passwords.account_passwords'))!;
    expect(insert.params[1]).toBe(SUB1);
    expect(insert.params[2]).toBe(BOSS);
  });
});

describe('PasswordsService: fortaleza y reutilización (solo informan)', () => {
  const access = { id: 'a1', manager_id: BOSS, employee_id: SUB1, deleted_at: null, expiry_date: null, employee_manager_id: null };

  it('una contraseña de 1 carácter se guarda y avisa que es débil', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(SUB1)] });
    const res = await service.create(userOf('u-sub1'), { ...createDto(SUB1), password: 'x' });
    expect(dbCalls.some((c) => c.sql.includes('INSERT INTO passwords.account_passwords'))).toBe(true);
    expect(res.passwordStrength).toBe('debil');
    expect(res.passwordWarnings).toEqual([WEAK_PASSWORD_WARNING]);
  });

  it('avisa en qué otras aplicaciones del mismo líder se repite, sin exponer contraseñas', async () => {
    const { service, dbCalls } = build({ accountRows: [accountRow(SUB1)], reusedIn: ['Canva', 'Figma'] });
    const res = await service.create(userOf('u-boss'), { ...createDto(SUB1), password: 'Segura#2026-Lievant' });
    expect(res.passwordStrength).toBe('fuerte');
    expect(res.passwordWarnings).toEqual([reusedPasswordWarning('Canva'), reusedPasswordWarning('Figma')]);
    const reuse = dbCalls.find((c) => c.sql.includes('AS reused_in'))!;
    expect(reuse.params[0]).toBe(BOSS); // mismo líder
    expect(reuse.params[2]).toBe('app'); // otra aplicación
    expect(reuse.sql).toContain('ap.deleted_at IS NULL');
  });

  it('al editar sin cambiar la contraseña no evalúa nada', async () => {
    const { service, dbCalls } = build({ revealRow: access, accountRows: [accountRow(SUB1)] });
    const res = await service.update(userOf('u-sub1'), 'a1', { username: 'nuevo@x.com' } as any);
    expect(res.passwordStrength).toBeNull();
    expect(res.passwordWarnings).toEqual([]);
    expect(dbCalls.some((c) => c.sql.includes('AS reused_in'))).toBe(false);
  });

  it('al editar la contraseña excluye la propia cuenta y usa el líder de la cuenta', async () => {
    const { service, dbCalls } = build({ revealRow: access, accountRows: [accountRow(SUB1)] });
    const res = await service.update(userOf('u-sub1'), 'a1', { password: 'Media1234' } as any);
    expect(res.passwordStrength).toBe('media');
    const reuse = dbCalls.find((c) => c.sql.includes('AS reused_in'))!;
    expect(reuse.params[0]).toBe(BOSS);
    expect(reuse.params[1]).toBe('a1');
  });
});

describe('evaluatePasswordStrength', () => {
  it.each([
    ['x', 'debil'],
    ['abcdefgh', 'debil'], // sin números ni mayúsculas
    ['abcdefg1', 'debil'], // sin mayúsculas
    ['Abcdefgh', 'debil'], // sin números
    ['Abcdefg1', 'media'],
    ['Abcdefghijk1', 'media'], // 12 pero sin símbolo
    ['Abcdefghij1!', 'fuerte'],
  ])('%s → %s', (pw, expected) => {
    expect(evaluatePasswordStrength(pw)).toBe(expected);
  });
});

describe('Catálogo de aplicaciones: guard con un usuario sin herramientas.passwords.write', () => {
  const guard = new PermissionsGuard(new Reflector());
  // Usuario común: rol COLABORADOR sin permisos del módulo y sin overrides.
  const colaborador = { id: 'u-colab', roles: [{ name: 'COLABORADOR', permissions: [] }], userPermissions: [] };
  const ctx = (handler: keyof PasswordsController) =>
    ({
      getHandler: () => PasswordsController.prototype[handler],
      getClass: () => PasswordsController,
      switchToHttp: () => ({ getRequest: () => ({ user: colaborador }) }),
    }) as unknown as ExecutionContext;

  it('POST /passwords/applications pasa el guard', () => {
    expect(guard.canActivate(ctx('createApplication'))).toBe(true);
  });

  it.each(['updateApplication', 'deactivateApplication'] as const)('%s (PATCH/DELETE) responde 403', (m) => {
    expect(() => guard.canActivate(ctx(m))).toThrow(ForbiddenException);
  });
});

describe('PasswordsService.createApplication', () => {
  function appService(existing: { name: string; isActive: boolean } | null = null) {
    const repo = {
      createQueryBuilder: () => {
        const qb: any = { where: () => qb, andWhere: () => qb, getOne: async () => existing };
        return qb;
      },
      create: (x: unknown) => x,
      save: jest.fn(async (x: unknown) => ({ id: 'nueva', ...(x as object) })),
    };
    const service = new PasswordsService({} as any, repo as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    return { service, repo };
  }

  it('normaliza el nombre: recorta y capitaliza solo la primera letra', async () => {
    const { service } = appService();
    const app = await service.createApplication({ name: '  draw.io ' }, 'u-1');
    expect(app.name).toBe('Draw.io');
  });

  it('un duplicado con distinta capitalización devuelve 409 con el nombre existente', async () => {
    const { service, repo } = appService({ name: 'Canva', isActive: true });
    const err = await service.createApplication({ name: 'CANVA' }, 'u-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getStatus()).toBe(HttpStatus.CONFLICT);
    expect((err as ConflictException).message).toContain('"Canva"');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza nombres de más de 100 caracteres', async () => {
    const { service, repo } = appService();
    await expect(service.createApplication({ name: 'x'.repeat(101) }, 'u-1')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(repo.save).not.toHaveBeenCalled();
  });

  it(`topa a ${APPLICATION_CREATE_LIMIT_PER_HOUR} altas por usuario por hora (429) sin afectar a otros`, async () => {
    const { service, repo } = appService();
    for (let i = 0; i < APPLICATION_CREATE_LIMIT_PER_HOUR; i++) {
      await service.createApplication({ name: `App ${i}` }, 'u-spam');
    }
    await expect(service.createApplication({ name: 'Una más' }, 'u-spam')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(repo.save).toHaveBeenCalledTimes(APPLICATION_CREATE_LIMIT_PER_HOUR);
    await expect(service.createApplication({ name: 'De otra persona' }, 'u-otro')).resolves.toBeTruthy();
  });

  it('los duplicados rechazados no consumen el tope', async () => {
    const { service } = appService({ name: 'Canva', isActive: true });
    for (let i = 0; i < APPLICATION_CREATE_LIMIT_PER_HOUR + 2; i++) {
      await expect(service.createApplication({ name: 'canva' }, 'u-1')).rejects.toBeInstanceOf(ConflictException);
    }
  });
});

// ============================================================================
// Transferencias
// ============================================================================

/** Jefe directo (direct_report_to_id) de cada expediente; incluye al inactivo. */
const bossOf: Record<string, string | null> = {
  [BOSS]: 'e-dir',
  [SUB1]: BOSS,
  [SUB2_INACTIVE]: BOSS,
  [JEFE_B]: BOSS,
  [NIETO]: JEFE_B,
  [PAR]: 'e-dir',
  [ALIEN]: null,
};
const inactive = new Set([SUB2_INACTIVE]);
const CIPHER = Buffer.from('c3c0d1f1cad0-no-se-toca');

interface TransferStore {
  account: {
    id: string;
    employee_id: string;
    manager_id: string;
    status: string;
    deleted_at: Date | null;
    password_encrypted: Buffer;
    expiry_notified_at: Date | null;
  };
  transfers: Record<string, unknown>[];
  events: { sql: string; params: unknown[] }[];
}

/**
 * Base en memoria con transacciones de verdad: `transaction` trabaja sobre una
 * copia y solo la publica si el callback termina bien; si lanza, se descarta.
 */
function buildTransfer(
  opts: { owner?: string; status?: string; deletedAt?: Date | null; failOn?: 'history' | 'event' } = {},
) {
  let store: TransferStore = {
    account: {
      id: 'a1',
      employee_id: opts.owner ?? SUB1,
      manager_id: BOSS,
      status: opts.status ?? 'activa',
      deleted_at: opts.deletedAt ?? null,
      password_encrypted: CIPHER,
      expiry_notified_at: new Date('2026-11-01'),
    },
    transfers: [],
    events: [],
  };
  const sqls: string[] = [];
  let clock = Date.parse('2026-11-26T10:00:00Z');

  const run = async (st: TransferStore, sql: string, params: unknown[] = []): Promise<unknown[]> => {
    sqls.push(sql);
    const acc = st.account;
    if (sql.includes('FOR UPDATE OF ap')) {
      if (params[0] !== acc.id) return [];
      return [
        {
          id: acc.id,
          employee_id: acc.employee_id,
          status: acc.status,
          deleted_at: acc.deleted_at,
          employee_name: employees[acc.employee_id]!.fullName,
          employee_manager_id: bossOf[acc.employee_id] ?? null,
        },
      ];
    }
    if (sql.includes('b.id AS boss_id')) {
      const e = employees[params[0] as string];
      if (!e) return [];
      const boss = bossOf[e.id];
      const bossActive = boss && boss !== e.id && employees[boss] && !inactive.has(boss) ? boss : null;
      return [
        { id: e.id, full_name: e.fullName, status: inactive.has(e.id) ? 'inactive' : 'active', deleted_at: null, boss_id: bossActive },
      ];
    }
    if (sql.includes('UPDATE passwords.account_passwords')) {
      Object.assign(acc, { employee_id: params[1], manager_id: params[2], expiry_notified_at: null });
      return [];
    }
    if (sql.includes('INSERT INTO passwords.account_transfers')) {
      if (opts.failOn === 'history') throw new Error('falla simulada del historial');
      clock += 60_000;
      const row = {
        id: `t${st.transfers.length + 1}`,
        account_id: params[0],
        from_employee_id: params[1],
        to_employee_id: params[2],
        from_employee_name: params[3],
        to_employee_name: params[4],
        transferred_by: params[5],
        transferred_by_name: params[6],
        reason: params[7],
        created_at: new Date(clock),
      };
      st.transfers.push(row);
      return [row];
    }
    if (sql.includes('INSERT INTO audit.security_events')) {
      if (opts.failOn === 'event') throw new Error('falla simulada del evento');
      st.events.push({ sql, params });
      return [];
    }
    if (sql.includes('FROM passwords.account_transfers')) {
      const rows = st.transfers.filter((t) => t.account_id === params[0]);
      // La base ordena; aquí solo se respeta el ORDER BY que pide el servicio.
      return sql.includes('ORDER BY created_at DESC')
        ? [...rows].sort((a, b) => (b.created_at as Date).getTime() - (a.created_at as Date).getTime())
        : rows;
    }
    if (sql.includes('e.direct_report_to_id AS employee_manager_id')) {
      return [
        {
          id: acc.id,
          manager_id: acc.manager_id,
          employee_id: acc.employee_id,
          deleted_at: acc.deleted_at,
          expiry_date: null,
          employee_manager_id: bossOf[acc.employee_id] ?? null,
        },
      ];
    }
    return [];
  };

  const clone = (st: TransferStore): TransferStore => ({
    account: { ...st.account },
    transfers: st.transfers.map((t) => ({ ...t })),
    events: [...st.events],
  });

  const { service, db } = build();
  (db as any).query = jest.fn((sql: string, params?: unknown[]) => run(store, sql, params));
  (db as any).transaction = jest.fn(async (cb: (m: unknown) => Promise<unknown>) => {
    const draft = clone(store);
    const result = await cb({ query: (sql: string, params?: unknown[]) => run(draft, sql, params) });
    store = draft;
    return result;
  });
  return {
    service,
    get store() {
      return store;
    },
    sqls,
  };
}

describe('PasswordsService.transfer (quién puede)', () => {
  it('el dueño transfiere su cuenta a cualquier colaborador activo', async () => {
    const t = buildTransfer({ owner: SUB1 });
    const res = await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: NIETO }, '10.0.0.1');
    expect(res.id).toBe('a1');
    expect(t.store.account.employee_id).toBe(NIETO);
    expect(res.transfer).toMatchObject({
      from: { id: SUB1, fullName: 'Ana Subordinada' },
      to: { id: NIETO, fullName: 'Nieto Indirecto' },
    });
  });

  it('su jefe directo actual también puede', async () => {
    const t = buildTransfer({ owner: SUB1 });
    await t.service.transfer(userOf('u-boss'), 'a1', { toEmployeeId: PAR }, null);
    expect(t.store.account.employee_id).toBe(PAR);
    expect(t.store.transfers[0]).toMatchObject({ transferred_by: 'u-boss', transferred_by_name: 'Jefa Ejemplo' });
  });

  it('el jefe directo puede transferir las cuentas de un colaborador dado de baja', async () => {
    const t = buildTransfer({ owner: SUB2_INACTIVE });
    await t.service.transfer(userOf('u-boss'), 'a1', { toEmployeeId: SUB1 }, null);
    expect(t.store.account.employee_id).toBe(SUB1);
  });

  it('SUPER_ADMIN puede, aunque no tenga expediente ni relación con el dueño', async () => {
    const t = buildTransfer({ owner: NIETO });
    const admin = { ...userOf('u-admin', true), name: 'Admin Global' };
    await t.service.transfer(admin, 'a1', { toEmployeeId: ALIEN }, null);
    expect(t.store.account.employee_id).toBe(ALIEN);
    expect(t.store.transfers[0]).toMatchObject({ transferred_by: 'u-admin', transferred_by_name: 'Admin Global' });
  });

  it.each([
    ['un colaborador ajeno', 'u-alien'],
    ['un par del dueño', 'u-par'],
    ['el jefe indirecto', 'u-boss'],
    ['un usuario sin expediente', 'u-sin-expediente'],
  ])('%s recibe 403 y no cambia nada', async (_quien, userId) => {
    const t = buildTransfer({ owner: NIETO });
    await expect(t.service.transfer(userOf(userId), 'a1', { toEmployeeId: PAR }, null)).rejects.toThrow(
      ForbiddenException,
    );
    expect(t.store.account.employee_id).toBe(NIETO);
    expect(t.store.transfers).toHaveLength(0);
    expect(t.store.events).toHaveLength(0);
  });

  it('a un ajeno se le responde 403 aunque la cuenta esté revocada (no se revela el estado)', async () => {
    const t = buildTransfer({ owner: SUB1, status: 'revocada', deletedAt: new Date() });
    await expect(t.service.transfer(userOf('u-alien'), 'a1', { toEmployeeId: PAR }, null)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('PasswordsService.transfer (rechazos 400)', () => {
  it.each([
    ['destino igual al dueño actual', SUB1, {}],
    ['destino inactivo o dado de baja', SUB2_INACTIVE, {}],
    ['destino inexistente', 'e-no-existe', {}],
    ['cuenta revocada (deleted_at)', PAR, { status: 'revocada', deletedAt: new Date() }],
    ['cuenta revocada (solo status)', PAR, { status: 'revocada' }],
  ] as const)('%s → 400 y no cambia nada', async (_caso, toEmployeeId, over) => {
    const t = buildTransfer({ owner: SUB1, ...over });
    const err = await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId }, null).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(t.store.account.employee_id).toBe(SUB1);
    expect(t.store.transfers).toHaveLength(0);
    expect(t.store.events).toHaveLength(0);
  });
});

describe('PasswordsService.transfer (efecto sobre la cuenta)', () => {
  it('password_encrypted es idéntico antes y después, y ninguna consulta lo toca', async () => {
    const t = buildTransfer({ owner: SUB1 });
    const before = Buffer.from(t.store.account.password_encrypted);
    await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: NIETO }, null);
    expect(t.store.account.password_encrypted.equals(before)).toBe(true);
    expect(t.sqls.join('\n')).not.toMatch(/password_encrypted|pgp_sym/);
  });

  it('manager_id pasa al jefe directo activo del destino (o al destino si no tiene) y se rearma el aviso', async () => {
    const t = buildTransfer({ owner: SUB1 });
    await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: NIETO }, null);
    expect(t.store.account.manager_id).toBe(JEFE_B);
    expect(t.store.account.expiry_notified_at).toBeNull();

    const t2 = buildTransfer({ owner: SUB1 });
    await t2.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: ALIEN }, null);
    expect(t2.store.account.manager_id).toBe(ALIEN);
  });

  it('registra historial con snapshot y el evento password_transfer (warning) con origen, destino y motivo', async () => {
    const t = buildTransfer({ owner: SUB1 });
    await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: NIETO, reason: 'Cambio de área' }, '::ffff:10.0.0.9');
    expect(t.store.transfers[0]).toMatchObject({
      account_id: 'a1',
      from_employee_id: SUB1,
      to_employee_id: NIETO,
      from_employee_name: 'Ana Subordinada',
      to_employee_name: 'Nieto Indirecto',
      transferred_by: 'u-sub1',
      transferred_by_name: 'Ana Subordinada',
      reason: 'Cambio de área',
    });
    expect(t.store.events).toHaveLength(1);
    const ev = t.store.events[0]!;
    expect(ev.sql).toMatch(/'password_transfer'[\s\S]*'passwords'[\s\S]*'warning'/);
    expect(ev.params.slice(0, 4)).toEqual(['u-sub1', 'u-sub1@lievant.com', '10.0.0.9', 'a1']);
    expect(JSON.parse(ev.params[4] as string)).toEqual({
      fromEmployeeId: SUB1,
      fromEmployeeName: 'Ana Subordinada',
      toEmployeeId: NIETO,
      toEmployeeName: 'Nieto Indirecto',
      reason: 'Cambio de área',
    });
  });

  it('un motivo vacío o de puros espacios se guarda como null', async () => {
    const t = buildTransfer({ owner: SUB1 });
    await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: NIETO, reason: '   ' }, null);
    expect(t.store.transfers[0]).toMatchObject({ reason: null });
  });

  it.each(['history', 'event'] as const)('si falla el insert de %s, el dueño no cambia (transacción)', async (failOn) => {
    const t = buildTransfer({ owner: SUB1, failOn });
    await expect(t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: NIETO }, null)).rejects.toThrow(
      /falla simulada/,
    );
    expect(t.store.account.employee_id).toBe(SUB1);
    expect(t.store.account.manager_id).toBe(BOSS);
    expect(t.store.transfers).toHaveLength(0);
    expect(t.store.events).toHaveLength(0);
  });

  it(`aplica un tope de ${TRANSFER_LIMIT_PER_HOUR} transferencias por hora por usuario`, async () => {
    const t = buildTransfer({ owner: SUB1 });
    const admin = userOf('u-admin', true);
    for (let i = 0; i < TRANSFER_LIMIT_PER_HOUR; i++) {
      const to = t.store.account.employee_id === SUB1 ? NIETO : SUB1;
      await t.service.transfer(admin, 'a1', { toEmployeeId: to }, null);
    }
    await expect(t.service.transfer(admin, 'a1', { toEmployeeId: PAR }, null)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(t.store.transfers).toHaveLength(TRANSFER_LIMIT_PER_HOUR);
  });
});

describe('PasswordsService.listTransfers', () => {
  it('devuelve el historial en orden cronológico inverso y sin contraseñas', async () => {
    const t = buildTransfer({ owner: SUB1 });
    await t.service.transfer(userOf('u-sub1'), 'a1', { toEmployeeId: BOSS, reason: 'primera' }, null);
    await t.service.transfer(userOf('u-boss'), 'a1', { toEmployeeId: SUB1, reason: 'segunda' }, null);
    const list = await t.service.listTransfers(userOf('u-sub1'), 'a1');
    expect(list.map((r) => r.reason)).toEqual(['segunda', 'primera']);
    expect(list[0]).toMatchObject({ from: { id: BOSS }, to: { id: SUB1 }, transferredBy: { name: 'Jefa Ejemplo' } });
    expect(JSON.stringify(list)).not.toMatch(/password|cipher|c3c0d1f1/i);
  });

  it('quien no puede ver la cuenta recibe 403', async () => {
    const t = buildTransfer({ owner: SUB1 });
    await expect(t.service.listTransfers(userOf('u-alien'), 'a1')).rejects.toThrow(ForbiddenException);
  });
});

describe('TransferAccountPasswordDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'body', metatype: TransferAccountPasswordDto };
  const to = 'cb1ba3e6-c74b-4645-a2e9-637a86d294e5';

  it('acepta destino con o sin motivo y recorta el motivo', async () => {
    await expect(pipe.transform({ toEmployeeId: to }, meta)).resolves.toBeDefined();
    const dto = await pipe.transform({ toEmployeeId: to, reason: '  Cambio de área  ' }, meta);
    expect(dto.reason).toBe('Cambio de área');
  });

  it.each([
    [{}, 'sin destino'],
    [{ toEmployeeId: 'no-es-uuid' }, 'destino inválido'],
    [{ toEmployeeId: to, reason: 'x'.repeat(301) }, 'motivo de 301'],
    [{ toEmployeeId: to, password: 'x' }, 'campo extra'],
  ])('rechaza %p (%s) con 400', async (body: Record<string, unknown>, _label: string) => {
    await expect(pipe.transform(body, meta)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });
});

describe('Modal "Transferir" (frontend) → API', () => {
  it('el botón de confirmación dice a quién se transfiere', () => {
    expect(transferConfirmLabel('Nieto Indirecto')).toBe('Transferir a Nieto Indirecto');
    expect(transferConfirmLabel(null)).toBe('Elige a quién transferir');
  });

  it('el aviso fijo advierte que la contraseña no cambia', () => {
    expect(TRANSFER_WARNING).toBe(
      'La contraseña no cambia. Quien la tenía todavía la conoce. Cámbiala en la plataforma después de transferir.',
    );
  });

  it('valida destino, dueño y largo del motivo', () => {
    expect(validateTransferForm({ ownerId: SUB1, toEmployeeId: '', reason: '' })).toBe('Elige a quién se transfiere la cuenta.');
    expect(validateTransferForm({ ownerId: SUB1, toEmployeeId: SUB1, reason: '' })).toBe('La cuenta ya es de esa persona.');
    expect(validateTransferForm({ ownerId: SUB1, toEmployeeId: NIETO, reason: 'x'.repeat(301) })).toMatch(/300/);
    expect(validateTransferForm({ ownerId: SUB1, toEmployeeId: NIETO, reason: 'x'.repeat(300) })).toBeNull();
  });

  it('el cuerpo pasa la validación del API y un motivo vacío no viaja', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const meta: ArgumentMetadata = { type: 'body', metatype: TransferAccountPasswordDto };
    const to = 'cb1ba3e6-c74b-4645-a2e9-637a86d294e5';
    expect(buildTransferPayload({ toEmployeeId: to, reason: '   ' })).toEqual({ toEmployeeId: to });
    const body = buildTransferPayload({ toEmployeeId: to, reason: ' Baja ' });
    expect(body).toEqual({ toEmployeeId: to, reason: 'Baja' });
    await expect(pipe.transform(body, meta)).resolves.toBeDefined();
  });
});
