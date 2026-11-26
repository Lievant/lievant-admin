import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';
import { NotificationFlowsService } from '../notifications/notification-flows.service';
// Regla de botones del modal de "Mis tickets" (frontend): misma que valida el API.
import { requesterActions } from '../../../../web/src/app/(dashboard)/herramientas/soporte/ticket-requester-actions';

const REQUESTER = { id: 'u-req', name: 'Ana Solicitante', roles: [], userPermissions: [] } as any;
const OTHER = { id: 'u-otro', name: 'Otro', roles: [], userPermissions: [] } as any;
const DIRECTOR = { id: 'u-dir', name: 'Directora', roles: [], userPermissions: [] } as any;
const TD = {
  id: 'u-td',
  name: 'Técnico',
  roles: [{ name: 'SOPORTE', permissions: [{ module: 'tickets.gestion' }] }],
  userPermissions: [],
} as any;

const DAY = 86_400_000;

function setup(over: Record<string, unknown> = {}) {
  const ticket: any = {
    id: 'tk-1',
    displayId: 'TIC-2026-050',
    requesterId: 'u-req',
    requesterName: 'Ana Solicitante',
    category: 'equipos',
    description: 'No enciende',
    priority: 'P3',
    status: 'en_atencion',
    requestedAt: new Date(Date.now() - 2 * DAY),
    closedAt: null,
    assignedTo: null,
    escalatedTo: null,
    openedByTd: false,
    diagnosis: 'DIAG-INTERNO: fuente dañada',
    internalNotes: 'NOTA-INTERNA: no avisar aún',
    problemStatus: 'en_analisis',
    solution: 'Se cambió la fuente.',
    collaboratorConfirmation: 'pendiente',
    deletedAt: null,
    ...over,
  };
  const history: any[] = [
    { ticketId: 'tk-1', action: 'creado', userName: 'Ana', oldValue: null, newValue: 'abierto' },
    { ticketId: 'tk-1', action: 'actualizado.internalNotes', oldValue: null, newValue: 'NOTA-INTERNA: no avisar aún' },
    { ticketId: 'tk-1', action: 'actualizado.diagnosis', oldValue: null, newValue: 'DIAG-INTERNO: fuente dañada' },
    { ticketId: 'tk-1', action: 'actualizado.solution', oldValue: null, newValue: 'Se cambió la fuente.' },
  ];
  const notifications: any[] = [];
  const flows: any[] = [];
  const service = Object.create(HelpdeskService.prototype) as any;
  service.logger = { error: jest.fn(), warn: jest.fn() };
  service.ticketsRepo = { findOne: async () => ticket, save: async (t: any) => t };
  service.historyRepo = {
    find: async () => history,
    create: (x: any) => x,
    save: async (x: any) => history.push(x),
    count: async ({ where }: any) => history.filter((h) => h.ticketId === where.ticketId && h.action === where.action).length,
  };
  service.surveysRepo = { count: async () => 0, findOne: async () => null };
  service.assigneesRepo = { findOne: async () => null };
  service.attachmentsRepo = { find: async () => [] };
  service.employeesRepo = { findOne: async () => null };
  service.usersRepo = { findOne: async () => null };
  service.notificationsService = { create: async (n: any) => notifications.push(n) };
  service.notificationFlows = { notify: async (...args: any[]) => flows.push(args) };
  const controller = new HelpdeskController(service as HelpdeskService);
  return { service: service as HelpdeskService, controller, ticket, history, notifications, flows };
}

describe('GET /helpdesk/tickets/:id (control de acceso)', () => {
  it('un usuario normal que lee un ticket ajeno recibe 404', async () => {
    await expect(setup().controller.findOne('tk-1', OTHER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TD lee cualquier ticket, con notas internas, diagnóstico e historial completo', async () => {
    const detail: any = await setup().controller.findOne('tk-1', TD);
    expect(detail.internalNotes).toContain('NOTA-INTERNA');
    expect(detail.diagnosis).toContain('DIAG-INTERNO');
    expect(detail.history.map((h: any) => h.action)).toContain('actualizado.internalNotes');
  });

  it('el solicitante lee el suyo sin notas internas, diagnóstico ni eventos internos', async () => {
    const detail: any = await setup().controller.findOne('tk-1', REQUESTER);
    expect(detail.displayId).toBe('TIC-2026-050');
    expect(detail.solution).toBe('Se cambió la fuente.');
    expect(detail).not.toHaveProperty('internalNotes');
    expect(detail).not.toHaveProperty('diagnosis');
    expect(detail).not.toHaveProperty('problemStatus');
    expect(detail.history.map((h: any) => h.action)).toEqual(['creado', 'actualizado.solution']);
    expect(JSON.stringify(detail)).not.toMatch(/NOTA-INTERNA|DIAG-INTERNO/);
  });

  it('el director al que se escaló lo ve, también sin el trabajo interno', async () => {
    const detail: any = await setup({ escalatedTo: 'u-dir' }).controller.findOne('tk-1', DIRECTOR);
    expect(JSON.stringify(detail)).not.toMatch(/NOTA-INTERNA|DIAG-INTERNO/);
  });

  it('un ticket borrado es 404 para el solicitante', async () => {
    await expect(setup({ deletedAt: new Date() }).controller.findOne('tk-1', REQUESTER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PATCH /helpdesk/tickets/:id/status (control de acceso)', () => {
  it('un usuario normal no cambia el estado de un ticket ajeno (403)', async () => {
    const t = setup({ status: 'cerrado', closedAt: new Date(Date.now() - DAY) });
    await expect(t.controller.updateStatus('tk-1', { status: 'abierto' }, OTHER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(t.ticket.status).toBe('cerrado');
  });

  it.each([
    ['en_atencion', 'cerrado'],
    ['en_atencion', 'resuelto'],
    ['resuelto', 'cerrado'],
    ['abierto', 'cancelado'],
    ['cerrado', 'en_atencion'],
  ])('el solicitante no puede forzar %s → %s en su ticket (403)', async (from: string, to: string) => {
    const t = setup({ status: from, closedAt: from === 'cerrado' ? new Date(Date.now() - DAY) : null });
    await expect(t.controller.updateStatus('tk-1', { status: to as any }, REQUESTER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(t.ticket.status).toBe(from);
  });

  it('el solicitante reabre su ticket cerrado dentro de 7 días (Reportar recurrencia)', async () => {
    const t = setup({ status: 'cerrado', closedAt: new Date(Date.now() - 3 * DAY) });
    await expect(
      t.controller.updateStatus('tk-1', { status: 'abierto', notes: 'Reapertura: problema recurrente.' }, REQUESTER),
    ).resolves.toMatchObject({ status: 'abierto', timesReopened: 1 });
  });

  it('pasados 7 días ya no puede reabrir (403)', async () => {
    const t = setup({ status: 'cerrado', closedAt: new Date(Date.now() - 8 * DAY) });
    await expect(t.controller.updateStatus('tk-1', { status: 'abierto' }, REQUESTER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('TD cambia el estado de cualquier ticket', async () => {
    const t = setup();
    await expect(t.controller.updateStatus('tk-1', { status: 'resuelto' }, TD)).resolves.toMatchObject({
      status: 'resuelto',
    });
  });
});

describe('PATCH /helpdesk/tickets/:id/confirm-resolution', () => {
  it('el solicitante confirma la resolución de su ticket sin tickets.gestion', async () => {
    const t = setup({ status: 'resuelto' });
    await expect(t.controller.confirmResolution('tk-1', REQUESTER)).resolves.toMatchObject({
      status: 'resuelto',
      collaboratorConfirmation: 'confirmado',
    });
    expect(t.history.at(-1)).toMatchObject({
      action: 'actualizado.collaboratorConfirmation',
      oldValue: 'pendiente',
      newValue: 'confirmado',
    });
  });

  it('en un ticket ajeno: 403, también para TD (no es su confirmación)', async () => {
    await expect(setup({ status: 'resuelto' }).controller.confirmResolution('tk-1', OTHER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(setup({ status: 'resuelto' }).controller.confirmResolution('tk-1', TD)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('solo en un ticket resuelto (400)', async () => {
    await expect(setup({ status: 'en_atencion' }).controller.confirmResolution('tk-1', REQUESTER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('los botones del modal siguen la misma regla', () => {
    const now = Date.now();
    const closed = (days: number) => new Date(now - days * DAY).toISOString();
    expect(requesterActions({ status: 'resuelto', closedAt: null, collaboratorConfirmation: 'pendiente' }, now)).toEqual({
      canConfirm: true,
      canReportRecurrence: false,
    });
    expect(requesterActions({ status: 'resuelto', closedAt: null, collaboratorConfirmation: 'confirmado' }, now).canConfirm).toBe(
      false,
    );
    expect(requesterActions({ status: 'cerrado', closedAt: closed(3), collaboratorConfirmation: null }, now).canReportRecurrence).toBe(
      true,
    );
    expect(requesterActions({ status: 'cerrado', closedAt: closed(8), collaboratorConfirmation: null }, now).canReportRecurrence).toBe(
      false,
    );
  });
});

describe('Las notificaciones al solicitante no llevan a la página de TD', () => {
  it('cierre y confirmación de escalación apuntan a "Mis tickets"; al director, a TD', async () => {
    const t = setup();
    await t.service.updateStatus('tk-1', { status: 'cerrado' }, TD, true);
    await (t.service as any).notifyEscalated(t.ticket, { authUserId: 'u-dir', fullName: 'Directora' }, TD, 'Urge');

    const toRequester = t.notifications.filter((n) => n.recipientId === 'u-req');
    expect(toRequester.length).toBe(2);
    for (const n of toRequester) {
      expect(n.actionUrl).toBe('/herramientas/soporte?ticket=tk-1');
      expect(n.actionUrl).not.toMatch(/transformacion/);
    }
    expect(t.notifications.find((n) => n.recipientId === 'u-dir').actionUrl).toBe('/transformacion/tickets/tk-1');
    // El flujo configurable recibe el enlace del solicitante aparte.
    expect(t.flows[0][2]).toMatchObject({ requesterActionUrl: '/herramientas/soporte?ticket=tk-1' });
  });

  it('el flujo configurable usa el enlace del solicitante solo para él', async () => {
    const flows = Object.create(NotificationFlowsService.prototype) as any;
    const sent: any[] = [];
    flows.logger = { error: jest.fn() };
    flows.notificationsService = { create: async (n: any) => sent.push(n) };
    flows.getFlow = async () => ({
      isActive: true,
      recipients: [
        { isActive: true, recipientType: 'solicitante', notificationType: 'informativa' },
        { isActive: true, recipientType: 'empleado', notificationType: 'informativa' },
      ],
    });
    flows.resolveRecipient = async (r: any) => (r.recipientType === 'solicitante' ? ['u-req'] : ['u-coord']);

    await flows.notify('helpdesk', 'ticket_escalado', {
      requesterId: 'u-req',
      actorId: 'u-td',
      title: 'x',
      message: 'y',
      actionUrl: '/transformacion/tickets/tk-1',
      requesterActionUrl: '/herramientas/soporte?ticket=tk-1',
    });
    expect(sent.find((n) => n.recipientId === 'u-req').actionUrl).toBe('/herramientas/soporte?ticket=tk-1');
    expect(sent.find((n) => n.recipientId === 'u-coord').actionUrl).toBe('/transformacion/tickets/tk-1');
  });
});
