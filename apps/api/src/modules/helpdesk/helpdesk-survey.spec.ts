import 'reflect-metadata';
import {
  ArgumentMetadata,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateTicketSurveyDto } from './dto/create-ticket-survey.dto';
import { HelpdeskService } from './helpdesk.service';
import { NotificationFlowsService } from '../notifications/notification-flows.service';

const REQUESTER = { id: 'u-req', name: 'Ana Solicitante', email: 'ana@lievant.com' } as any;
const OTHER = { id: 'u-otro', name: 'Otro', email: 'otro@lievant.com' } as any;
const TD = { id: 'u-td', name: 'Técnico', email: 'td@lievant.com' } as any;

/**
 * Servicio con repositorios en memoria: historial, encuestas, notificaciones y
 * el flujo configurable. `opts.flowFails` simula que el aviso al coordinador
 * truena; `opts.uniqueRace` que otro envío ganó la carrera del UNIQUE.
 */
const TECH_USER = {
  id: 'u-tech',
  name: 'Técnico Uno',
  email: 'tecnico@lievant.com',
  roles: [{ name: 'SOPORTE', permissions: [{ module: 'tickets.gestion' }] }],
  userPermissions: [],
};

function setup(
  over: Record<string, unknown> = {},
  opts: { flowFails?: boolean; uniqueRace?: boolean; notifyFails?: boolean; techUser?: any } = {},
) {
  const ticket: any = {
    id: 'tk-1',
    displayId: 'TIC-2026-040',
    requesterId: 'u-req',
    requesterName: 'Ana Solicitante',
    status: 'en_atencion',
    closedAt: null,
    requestedAt: new Date('2026-11-26T08:00:00Z'),
    deletedAt: null,
    ...over,
  };
  const history: any[] = [];
  const surveys: any[] = [];
  const notifications: any[] = [];
  const flows: any[] = [];
  const service = Object.create(HelpdeskService.prototype) as any;
  service.logger = { error: jest.fn(), warn: jest.fn() };
  service.ticketsRepo = { findOne: async () => ticket, save: async (t: any) => t };
  service.historyRepo = {
    create: (x: any) => x,
    save: async (x: any) => history.push(x),
    count: async ({ where }: any) => history.filter((h) => h.ticketId === where.ticketId && h.action === where.action).length,
  };
  service.surveysRepo = {
    create: (x: any) => x,
    count: async ({ where }: any) => surveys.filter((s) => s.ticketId === where.ticketId).length,
    findOne: async ({ where }: any) => surveys.find((s) => s.ticketId === where.ticketId) ?? null,
    save: async (x: any) => {
      if (opts.uniqueRace) throw Object.assign(new Error('duplicate key'), { code: '23505' });
      const row = { ...x, id: `s${surveys.length + 1}`, createdAt: new Date('2026-11-26T12:00:00Z') };
      surveys.push(row);
      return row;
    },
  };
  service.employeesRepo = { findOne: async () => ({ fullName: 'Ana Solicitante (expediente)' }) };
  service.notificationsService = {
    create: async (n: any) => {
      if (opts.notifyFails && n.title?.startsWith('Calificación recibida')) throw new Error('socket caído');
      notifications.push(n);
    },
  };
  service.assigneesRepo = {
    findOne: async ({ where }: any) =>
      where.id === 'as-1' ? { id: 'as-1', name: 'Técnico Uno', email: 'tecnico@lievant.com' } : null,
  };
  const techUser = 'techUser' in opts ? opts.techUser : TECH_USER;
  service.usersRepo = { findOne: async ({ where }: any) => (where.email === 'tecnico@lievant.com' ? techUser : null) };
  service.notificationFlows = {
    notify: async (...args: any[]) => {
      if (opts.flowFails) throw new Error('flujo caído');
      flows.push(args);
      return 1;
    },
  };
  return { service: service as HelpdeskService, ticket, history, surveys, notifications, flows };
}

async function closeIt(t: ReturnType<typeof setup>) {
  await t.service.updateStatus('tk-1', { status: 'cerrado' }, TD, true);
}

describe('Encuesta: invitación al cerrar', () => {
  it('al cerrar se invita al solicitante real, con enlace al ticket', async () => {
    const t = setup();
    await closeIt(t);
    expect(t.notifications).toHaveLength(1);
    expect(t.notifications[0]).toMatchObject({
      recipientId: 'u-req',
      actionUrl: '/herramientas/soporte?ticket=tk-1',
    });
    expect(t.notifications[0].message).toMatch(/Cómo fue la atención/);
    expect(t.history.map((h) => h.action)).toEqual(['estado_cambiado', 'encuesta_solicitada']);
  });

  it('los tickets de la Auditoría (creados ya cerrados) no generan encuesta: 400 al responder', async () => {
    // createClosedTicket no pasa por updateStatus: el ticket nace cerrado sin invitación.
    const t = setup({ status: 'cerrado', closedAt: new Date(), openedByTd: true });
    await expect(t.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER)).rejects.toBeInstanceOf(BadRequestException);
    expect(t.surveys).toHaveLength(0);
  });

  it('un ticket cerrado antes de este cambio (sin invitación) no recibe encuesta retroactiva', async () => {
    const t = setup({ status: 'cerrado', closedAt: new Date('2026-10-01T00:00:00Z') });
    const state = await t.service.getSurvey('tk-1', REQUESTER, false);
    expect(state).toEqual({ survey: null, canAnswerSurvey: false });
  });
});

describe('POST /helpdesk/tickets/:id/survey', () => {
  it('el solicitante responde una vez y se avisa al coordinador con ticket, calificación y comentario', async () => {
    const t = setup();
    await closeIt(t);
    const res = await t.service.answerSurvey('tk-1', { rating: 'triste', comment: 'Tardó mucho' }, REQUESTER);
    expect(res).toMatchObject({ rating: 'triste', comment: 'Tardó mucho', answeredByName: 'Ana Solicitante (expediente)' });
    expect(t.surveys[0]).toMatchObject({ ticketId: 'tk-1', answeredBy: 'u-req' });
    expect(t.flows).toHaveLength(1);
    const [module, event, ctx] = t.flows[0];
    expect([module, event]).toEqual(['helpdesk', 'encuesta_respondida']);
    expect(ctx.message).toContain('TIC-2026-040');
    expect(ctx.message).toContain('Triste');
    expect(ctx.message).toContain('Tardó mucho');
  });

  it('otro usuario no puede responder (403)', async () => {
    const t = setup();
    await closeIt(t);
    await expect(t.service.answerSurvey('tk-1', { rating: 'feliz' }, OTHER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(t.service.answerSurvey('tk-1', { rating: 'feliz' }, TD)).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.surveys).toHaveLength(0);
  });

  it('ticket abierto: 400', async () => {
    const t = setup();
    await closeIt(t);
    t.ticket.status = 'abierto'; // reabierto
    await expect(t.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('segunda respuesta: 409 (también si otro envío gana la carrera del UNIQUE)', async () => {
    const t = setup();
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER);
    await expect(t.service.answerSurvey('tk-1', { rating: 'enojado' }, REQUESTER)).rejects.toBeInstanceOf(ConflictException);
    expect(t.surveys).toHaveLength(1);

    const race = setup({}, { uniqueRace: true });
    await closeIt(race);
    await expect(race.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('un fallo del aviso al coordinador no deshace la respuesta', async () => {
    const t = setup({}, { flowFails: true });
    await closeIt(t);
    await expect(t.service.answerSurvey('tk-1', { rating: 'normal' }, REQUESTER)).resolves.toMatchObject({ rating: 'normal' });
    expect(t.surveys).toHaveLength(1);
    expect((t.service as any).logger.error).toHaveBeenCalled();
  });

  it('reabierto y vuelto a cerrar ya respondido: no se vuelve a invitar', async () => {
    const t = setup();
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER);
    t.ticket.status = 'abierto';
    await closeIt(t);
    expect(t.notifications[1].message).not.toMatch(/Cómo fue la atención/);
    expect(t.history.filter((h) => h.action === 'encuesta_solicitada')).toHaveLength(1);
  });
});

describe('GET /helpdesk/tickets/:id/survey', () => {
  it('la ven el solicitante y TD; otro usuario recibe 403', async () => {
    const t = setup();
    await closeIt(t);
    expect(await t.service.getSurvey('tk-1', REQUESTER, false)).toEqual({ survey: null, canAnswerSurvey: true });
    await t.service.answerSurvey('tk-1', { rating: 'feliz', comment: 'Gracias' }, REQUESTER);
    const asTd = await t.service.getSurvey('tk-1', TD, true);
    expect(asTd.survey).toMatchObject({ rating: 'feliz', comment: 'Gracias' });
    expect(asTd.canAnswerSurvey).toBe(false);
    await expect(t.service.getSurvey('tk-1', OTHER, false)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('DTO de la encuesta', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'body', metatype: CreateTicketSurveyDto };

  it.each(['feliz', 'normal', 'triste', 'enojado'])('acepta %p', async (rating) => {
    await expect(pipe.transform({ rating }, meta)).resolves.toBeDefined();
  });

  it('recorta el comentario', async () => {
    const dto = await pipe.transform({ rating: 'feliz', comment: '  Muy bien  ' }, meta);
    expect(dto.comment).toBe('Muy bien');
  });

  it.each([
    [{ rating: 'excelente' }, 'calificación inválida'],
    [{}, 'sin calificación'],
    [{ rating: 'feliz', comment: 'x'.repeat(1001) }, 'comentario de 1001'],
    [{ rating: 'feliz', ticketId: 'otro' }, 'campo extra'],
  ])('rechaza %p (%s) con 400', async (body: Record<string, unknown>, _label: string) => {
    await expect(pipe.transform(body, meta)).rejects.toMatchObject({ status: 400 });
  });
});

describe('Aviso al técnico asignado con la calificación', () => {
  const closedWithTech = { assignedTo: 'as-1' };
  const techNotes = (t: ReturnType<typeof setup>) => t.notifications.filter((n) => n.recipientId === 'u-tech');

  it('se notifica al técnico asignado con folio, calificación, nombre y comentario', async () => {
    const t = setup(closedWithTech);
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: 'feliz', comment: 'Muy rápido, gracias' }, REQUESTER);
    const [n] = techNotes(t);
    expect(n).toMatchObject({
      title: 'Calificación recibida: Feliz',
      type: 'informativa',
      actionUrl: '/transformacion/tickets/tk-1',
      entityId: 'tk-1',
    });
    expect(n.message).toContain('TIC-2026-040');
    expect(n.message).toContain('Feliz');
    expect(n.message).toContain('Muy rápido, gracias');
    expect(n.message).toContain('Ana Solicitante (expediente)');
    // Del solicitante solo va el nombre.
    expect(n.message).not.toMatch(/ana@lievant\.com|u-req/);
  });

  it.each([
    ['triste', 'Triste'],
    ['enojado', 'Enojado'],
  ])('%s sale como atención', async (rating: string, label: string) => {
    const t = setup(closedWithTech);
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: rating as any }, REQUESTER);
    expect(techNotes(t)[0]).toMatchObject({ title: `Calificación recibida: ${label}`, type: 'atencion' });
  });

  it('el comentario se recorta a 300 caracteres con …', async () => {
    const t = setup(closedWithTech);
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: 'normal', comment: 'x'.repeat(500) }, REQUESTER);
    const msg: string = techNotes(t)[0].message;
    expect(msg).toContain(`${'x'.repeat(300)}…`);
    expect(msg).not.toContain('x'.repeat(301));
  });

  it('sin técnico asignado o sin usuario vinculado se omite sin error', async () => {
    const none = setup();
    await closeIt(none);
    await expect(none.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER)).resolves.toMatchObject({ rating: 'feliz' });
    expect(techNotes(none)).toHaveLength(0);

    const noUser = setup(closedWithTech, { techUser: null });
    await closeIt(noUser);
    await expect(noUser.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER)).resolves.toMatchObject({
      rating: 'feliz',
    });
    expect(noUser.notifications.filter((n) => n.title?.startsWith('Calificación'))).toHaveLength(0);
    expect(noUser.flows[0][2]).not.toHaveProperty('excludeUserIds');
  });

  it('un técnico que no es TD recibe el aviso sin enlace (la página de TD le daría 404)', async () => {
    const t = setup(closedWithTech, { techUser: { ...TECH_USER, roles: [] } });
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER);
    expect(techNotes(t)[0]).not.toHaveProperty('actionUrl');
  });

  it('si falla el envío al técnico, la encuesta queda y el flujo sigue', async () => {
    const t = setup(closedWithTech, { notifyFails: true });
    await closeIt(t);
    await expect(t.service.answerSurvey('tk-1', { rating: 'enojado' }, REQUESTER)).resolves.toMatchObject({
      rating: 'enojado',
    });
    expect(t.surveys).toHaveLength(1);
    expect((t.service as any).logger.error).toHaveBeenCalled();
    // Como no le llegó el directo, el flujo no lo excluye.
    expect(t.flows[0][2]).not.toHaveProperty('excludeUserIds');
  });

  it('el flujo encuesta_respondida no le manda un segundo aviso al técnico', async () => {
    const t = setup(closedWithTech);
    await closeIt(t);
    await t.service.answerSurvey('tk-1', { rating: 'feliz' }, REQUESTER);
    expect(t.flows[0][2]).toMatchObject({ excludeUserIds: ['u-tech'] });

    // Y el servicio de flujos respeta la exclusión aunque el técnico sea destinatario configurado.
    const flows = Object.create(NotificationFlowsService.prototype) as any;
    const sent: any[] = [];
    flows.logger = { error: jest.fn() };
    flows.notificationsService = { create: async (n: any) => sent.push(n) };
    flows.getFlow = async () => ({
      isActive: true,
      recipients: [
        { isActive: true, recipientType: 'empleado', notificationType: 'informativa', employeeId: 'e-coord' },
        { isActive: true, recipientType: 'empleado', notificationType: 'informativa', employeeId: 'e-tech' },
      ],
    });
    flows.resolveRecipient = async (r: any) => [r.employeeId === 'e-tech' ? 'u-tech' : 'u-coord'];
    await flows.notify('helpdesk', 'encuesta_respondida', { ...t.flows[0][2] });
    expect(sent.map((n) => n.recipientId)).toEqual(['u-coord']);
  });
});
