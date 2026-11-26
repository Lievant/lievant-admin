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

const REQUESTER = { id: 'u-req', name: 'Ana Solicitante', email: 'ana@lievant.com' } as any;
const OTHER = { id: 'u-otro', name: 'Otro', email: 'otro@lievant.com' } as any;
const TD = { id: 'u-td', name: 'Técnico', email: 'td@lievant.com' } as any;

/**
 * Servicio con repositorios en memoria: historial, encuestas, notificaciones y
 * el flujo configurable. `opts.flowFails` simula que el aviso al coordinador
 * truena; `opts.uniqueRace` que otro envío ganó la carrera del UNIQUE.
 */
function setup(over: Record<string, unknown> = {}, opts: { flowFails?: boolean; uniqueRace?: boolean } = {}) {
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
  service.notificationsService = { create: async (n: any) => notifications.push(n) };
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
