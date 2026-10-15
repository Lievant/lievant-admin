import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { PERMISSION_KEY } from '../auth/decorators/permission.decorator';
import { PasswordsController } from './passwords.controller';
import { PasswordsService } from './passwords.service';

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

function build(opts: { accountRows?: Record<string, unknown>[]; revealRow?: Record<string, unknown> } = {}) {
  const dbCalls: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      dbCalls.push({ sql, params });
      if (sql.includes('FROM passwords.account_passwords ap\n      JOIN passwords.applications')) {
        return opts.accountRows ?? [];
      }
      if (sql.includes('e.direct_report_to_id AS employee_manager_id')) return opts.revealRow ? [opts.revealRow] : [];
      if (sql.includes('FROM passwords.reveal_log')) return [{ count: 0 }];
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
    {} as any,
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

describe('PasswordsController (permisos y exportación)', () => {
  const required = (m: keyof PasswordsController) =>
    Reflect.getMetadata(PERMISSION_KEY, PasswordsController.prototype[m]);

  it.each(['list', 'reveal', 'getVisiblePeople', 'isManager', 'getTeamEmployees', 'listApplications'] as const)(
    '%s no exige permiso: el alcance lo fija el servicio',
    (m) => {
      expect(required(m)).toBeUndefined();
    },
  );

  it.each(['create', 'update', 'revoke', 'createApplication'] as const)(
    '%s sigue exigiendo herramientas.passwords.write',
    (m) => {
      expect(required(m)).toEqual({ section: 'herramientas', module: 'passwords', action: 'write' });
    },
  );

  it('ya no existe un endpoint para exportar a Excel', () => {
    const methods = Object.getOwnPropertyNames(PasswordsController.prototype);
    expect(methods.filter((m) => /export|excel|xlsx/i.test(m))).toEqual([]);
  });
});
