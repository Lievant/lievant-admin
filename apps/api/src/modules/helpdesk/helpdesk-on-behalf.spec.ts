import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { InventoryController } from '../inventory/inventory.controller';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { HelpdeskService } from './helpdesk.service';
import { isTdUser } from './td-user.util';

const TD_USER = {
  id: 'u-td',
  name: 'Paulo Ossa (TD)',
  email: 'paulo@lievant.com',
  roles: [{ name: 'TECNICO_TD', permissions: [{ section: 'transformacion', module: 'tickets.gestion', action: 'read' }] }],
  userPermissions: [],
} as any;
const NORMAL_USER = { id: 'u-normal', name: 'Ana Normal', email: 'ana@lievant.com', roles: [{ name: 'COLABORADOR', permissions: [] }], userPermissions: [] } as any;

const TARGET_EMP = '11111111-1111-4111-8111-111111111111';
const TARGET_USER = 'u-target';

function employee(over: Record<string, unknown> = {}) {
  return {
    id: TARGET_EMP,
    fullName: 'TEST-Titular Dos',
    area: 'TEST-Operaciones',
    division: null,
    status: 'active',
    authUserId: TARGET_USER,
    deletedAt: null,
    ...over,
  };
}

function setup(opts: { target?: any; targetUser?: any; ownEmployee?: any; equipmentFound?: boolean } = {}) {
  const saved: any[] = [];
  const history: any[] = [];
  const service = Object.create(HelpdeskService.prototype) as any;
  service.ticketsRepo = {
    findOne: async () => null,
    create: (x: any) => x,
    save: async (t: any) => {
      const row = { id: 'tk-1', ...t };
      saved.push(row);
      return row;
    },
    query: async () => (opts.equipmentFound === false ? [] : [{ '?column?': 1 }]),
  };
  service.employeesRepo = {
    findOne: async ({ where }: any) => {
      if (where.id) return opts.target === undefined ? employee() : opts.target;
      if (where.authUserId) return opts.ownEmployee ?? null;
      return null;
    },
  };
  service.usersRepo = {
    findOne: async () => (opts.targetUser === undefined ? { id: TARGET_USER, isActive: true, deletedAt: null } : opts.targetUser),
  };
  service.categoriesRepo = { findOne: async () => ({ priorityBase: 'P3' }) };
  service.historyRepo = { create: (x: any) => x, save: async (x: any) => history.push(x) };
  return { service: service as HelpdeskService, saved, history };
}

const base = { category: 'equipos', description: 'Descripción de prueba con más de veinte caracteres', impact: 'medio' } as any;
const behalf = { ...base, onBehalfOfEmployeeId: TARGET_EMP, behalfReason: 'Colaborador sin acceso al sistema' };

describe('Tickets · abrir en nombre de otra persona', () => {
  it('(a) con permiso TD, el solicitante es la persona elegida y el autor del evento es el usuario de TD', async () => {
    const { service, saved, history } = setup();
    await service.create(behalf, TD_USER, true);
    expect(saved[0]).toMatchObject({
      requesterId: TARGET_USER,
      requesterName: 'TEST-Titular Dos',
      requesterArea: 'TEST-Operaciones',
      openedByTd: true,
      openedOnBehalfOf: 'TEST-Titular Dos',
      behalfReason: 'Colaborador sin acceso al sistema',
    });
    expect(saved[0].requesterId).not.toBe(TD_USER.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ userId: 'u-td', userName: 'Paulo Ossa (TD)', action: 'creado' });
    expect(history[0].notes).toContain('Abierto por TD en nombre de TEST-Titular Dos');
    expect(history[0].notes).toContain('Colaborador sin acceso al sistema');
  });

  it('(b) sin permiso TD el campo se rechaza (403) y no se guarda nada', async () => {
    const { service, saved } = setup();
    await expect(service.create(behalf, NORMAL_USER, false)).rejects.toThrow(ForbiddenException);
    expect(saved).toHaveLength(0);
  });

  it('(b) sin permiso TD, las banderas de TD que mande el cliente se ignoran y el solicitante es la sesión', async () => {
    const { service, saved } = setup({ ownEmployee: employee({ id: 'e-own', fullName: 'Ana Normal', area: 'Ventas' }) });
    await service.create({ ...base, openedByTd: true, openedOnBehalfOf: 'Otro', behalfReason: 'x' }, NORMAL_USER, false);
    expect(saved[0]).toMatchObject({ requesterId: 'u-normal', requesterName: 'Ana Normal', requesterArea: 'Ventas', openedByTd: false, openedOnBehalfOf: null, behalfReason: null });
  });

  it('un ticket normal (sin "en nombre de") queda a nombre de quien lo abre, incluso siendo TD', async () => {
    const { service, saved, history } = setup({ ownEmployee: employee({ id: 'e-td', fullName: 'Paulo Ossa', area: 'TD' }) });
    await service.create(base, TD_USER, true);
    expect(saved[0]).toMatchObject({ requesterId: 'u-td', requesterName: 'Paulo Ossa', requesterArea: 'TD', openedByTd: false });
    expect(history[0].notes).toBeNull();
  });

  it('(c) persona inexistente → 404', async () => {
    const { service, saved } = setup({ target: null });
    await expect(service.create(behalf, TD_USER, true)).rejects.toThrow(NotFoundException);
    expect(saved).toHaveLength(0);
  });

  it('(c) persona dada de baja (deleted_at o estado inactivo) → error', async () => {
    await expect(setup({ target: employee({ deletedAt: new Date() }) }).service.create(behalf, TD_USER, true)).rejects.toThrow(NotFoundException);
    await expect(setup({ target: employee({ status: 'inactive' }) }).service.create(behalf, TD_USER, true)).rejects.toThrow(BadRequestException);
  });

  it('(c) persona sin usuario vinculado o con usuario inactivo → error claro, sin guardar', async () => {
    const a = setup({ target: employee({ authUserId: null }) });
    await expect(a.service.create(behalf, TD_USER, true)).rejects.toThrow(/no tiene un usuario vinculado/);
    expect(a.saved).toHaveLength(0);
    await expect(setup({ targetUser: { id: TARGET_USER, isActive: false, deletedAt: null } }).service.create(behalf, TD_USER, true)).rejects.toThrow(BadRequestException);
    await expect(setup({ targetUser: null }).service.create(behalf, TD_USER, true)).rejects.toThrow(BadRequestException);
  });

  it('(d) el motivo es obligatorio en este modo, validado en el servidor', async () => {
    const { service, saved } = setup();
    await expect(service.create({ ...behalf, behalfReason: undefined }, TD_USER, true)).rejects.toThrow('El motivo de apertura por TD es obligatorio.');
    await expect(service.create({ ...behalf, behalfReason: '   ' }, TD_USER, true)).rejects.toThrow(BadRequestException);
    expect(saved).toHaveLength(0);
  });

  it('el equipo elegido debe existir, pero no tiene que ser del solicitante', async () => {
    await expect(setup({ equipmentFound: false }).service.create({ ...behalf, equipmentId: 'NO-EXISTE' }, TD_USER, true)).rejects.toThrow('El equipo elegido no existe.');
    const ok = setup();
    await ok.service.create({ ...behalf, equipmentId: 'MA053' }, TD_USER, true);
    expect(ok.saved[0].equipmentId).toBe('MA053');
  });
});

describe('isTdUser', () => {
  it('SUPER_ADMIN, permiso de tickets.gestion por rol o individual; nadie más', () => {
    expect(isTdUser({ roles: [{ name: 'SUPER_ADMIN' }], userPermissions: [] } as any)).toBe(true);
    expect(isTdUser(TD_USER)).toBe(true);
    expect(isTdUser({ roles: [], userPermissions: [{ granted: true, permission: { module: 'tickets.gestion' } }] } as any)).toBe(true);
    expect(isTdUser({ roles: [], userPermissions: [{ granted: false, permission: { module: 'tickets.gestion' } }] } as any)).toBe(false);
    expect(isTdUser(NORMAL_USER)).toBe(false);
  });
});

describe('DTO de creación de ticket', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'body', metatype: CreateTicketDto };
  it('acepta onBehalfOfEmployeeId UUID y rechaza otro valor', async () => {
    await expect(pipe.transform({ ...base, onBehalfOfEmployeeId: TARGET_EMP }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ ...base, onBehalfOfEmployeeId: 'Daniel' }, meta)).rejects.toThrow(BadRequestException);
  });
});

describe('Equipos del formulario de ticket (GET /inventory/equipment/search)', () => {
  function controller() {
    const calls: { q?: string; employeeId?: string }[] = [];
    const service = {
      findEmployeeIdByEmail: async (email: string) => (email === 'ana@lievant.com' ? 'emp-ana' : email === 'paulo@lievant.com' ? 'emp-paulo' : null),
      searchEquipment: async (q?: string, employeeId?: string) => {
        calls.push({ ...(q !== undefined ? { q } : {}), ...(employeeId !== undefined ? { employeeId } : {}) });
        return [];
      },
    };
    return { ctl: new InventoryController(service as any, {} as any), calls };
  }

  it('(e) TD puede pedir los equipos de otro empleado', async () => {
    const { ctl, calls } = controller();
    await ctl.searchEquipment(TD_USER, undefined, 'emp-otro');
    expect(calls[0]).toEqual({ employeeId: 'emp-otro' });
  });

  it('(e) un usuario normal que manipula la petición solo recibe los suyos', async () => {
    const { ctl, calls } = controller();
    await ctl.searchEquipment(NORMAL_USER, undefined, 'emp-otro');
    expect(calls[0]).toEqual({ employeeId: 'emp-ana' });
  });

  it('(e) "me" sigue resolviendo al expediente de la sesión; sin expediente, vacío', async () => {
    const { ctl, calls } = controller();
    await ctl.searchEquipment(NORMAL_USER, undefined, 'me');
    expect(calls[0]).toEqual({ employeeId: 'emp-ana' });
    const ghost = { ...NORMAL_USER, email: 'sin-expediente@lievant.com' };
    expect(await ctl.searchEquipment(ghost, undefined, 'emp-otro')).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('el buscador por ID, marca o modelo sin restricción de persona sigue igual', async () => {
    const { ctl, calls } = controller();
    await ctl.searchEquipment(NORMAL_USER, 'macbook');
    expect(calls[0]).toEqual({ q: 'macbook' });
  });

  it('quien gestiona inventario o líneas telefónicas también puede consultar los de otra persona', async () => {
    const inv = { ...NORMAL_USER, roles: [{ name: 'X', permissions: [{ section: 'transformacion', module: 'inventario', action: 'read' }] }] };
    const sim = { ...NORMAL_USER, roles: [{ name: 'X', permissions: [{ section: 'transformacion', module: 'sim-cards', action: 'write' }] }] };
    for (const u of [inv, sim]) {
      const { ctl, calls } = controller();
      await ctl.searchEquipment(u, undefined, 'emp-otro');
      expect(calls[0]).toEqual({ employeeId: 'emp-otro' });
    }
  });
});
