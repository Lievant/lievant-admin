import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';
import { resolveSurveySummaryRange, satisfactionPct, startOfDayInZone } from './survey-summary';

const TD = {
  id: 'u-td',
  name: 'Técnico',
  roles: [{ name: 'SOPORTE', permissions: [{ module: 'tickets.gestion' }] }],
  userPermissions: [],
} as any;
const NORMAL = { id: 'u-normal', name: 'Colaborador', roles: [], userPermissions: [] } as any;

/**
 * Base SIMULADA: `manager.query` reconoce las dos consultas del resumen y las
 * resuelve en memoria con los parámetros que recibe ($1 inicio, $2 fin
 * excluido, $3 la marca). Valida límites, conteos y porcentajes; el SQL real
 * contra PostgreSQL queda para staging.
 */
interface Survey {
  ticketId: string;
  rating: string;
  createdAt: string;
}
interface Mark {
  ticketId: string;
  action: string;
  createdAt: string;
}

function setup(data: { surveys?: Survey[]; marks?: Mark[]; deleted?: string[] } = {}) {
  const surveys = data.surveys ?? [];
  const marks = data.marks ?? [];
  const deleted = new Set(data.deleted ?? []);
  const calls: unknown[][] = [];
  const inRange = (iso: string, start: Date, end: Date) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  };
  const query = async (sql: string, params: any[]) => {
    calls.push(params);
    const [start, end, action] = params as [Date, Date, string?];
    if (sql.includes('GROUP BY s.rating')) {
      const counts: Record<string, number> = {};
      for (const s of surveys) {
        if (!deleted.has(s.ticketId) && inRange(s.createdAt, start, end)) counts[s.rating] = (counts[s.rating] ?? 0) + 1;
      }
      return Object.entries(counts).map(([rating, count]) => ({ rating, count }));
    }
    if (sql.includes('AS enviadas')) {
      const sent = new Set(
        marks
          .filter((m) => m.action === action && !deleted.has(m.ticketId) && inRange(m.createdAt, start, end))
          .map((m) => m.ticketId),
      );
      const answered = [...sent].filter((id) => surveys.some((s) => s.ticketId === id)).length;
      return [{ enviadas: sent.size, respondidas: answered }];
    }
    throw new Error(`Consulta no simulada: ${sql}`);
  };
  const service = Object.create(HelpdeskService.prototype) as any;
  service.ticketsRepo = { manager: { query } };
  return { service: service as HelpdeskService, controller: new HelpdeskController(service), calls };
}

const mark = (ticketId: string, createdAt: string): Mark => ({ ticketId, action: 'encuesta_solicitada', createdAt });

describe('GET /helpdesk/surveys/summary · conteos y porcentajes', () => {
  it('cuenta por calificación y calcula % de satisfacción (Feliz ÷ total) y tasa de respuesta', async () => {
    const at = '2026-11-10T18:00:00Z';
    const surveys: Survey[] = [
      ...['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'].map((id) => ({
        ticketId: id,
        rating: 'feliz',
        createdAt: at,
      })),
      { ticketId: 't11', rating: 'normal', createdAt: at },
      { ticketId: 't12', rating: 'enojado', createdAt: at },
    ];
    const marks = [...surveys.map((s) => mark(s.ticketId, at)), ...['t13', 't14', 't15', 't16'].map((id) => mark(id, at))];
    const { controller } = setup({ surveys, marks });
    const r: any = await controller.getSurveySummary('2026-11-01', '2026-11-30', TD);
    expect(r).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
      total: 12,
      porCalificacion: { feliz: 10, normal: 1, triste: 0, enojado: 1 },
      satisfaccionPct: 83.3,
      enviadas: 16,
      respondidasDeEnviadas: 12,
      tasaRespuestaPct: 75,
    });
  });

  it('total 0 devuelve porcentajes null, no 0', async () => {
    const { controller } = setup({ marks: [mark('t1', '2026-11-10T18:00:00Z')] });
    const r: any = await controller.getSurveySummary('2026-11-01', '2026-11-30', TD);
    expect(r).toMatchObject({ total: 0, satisfaccionPct: null, tasaRespuestaPct: null, enviadas: 1 });
    expect(satisfactionPct({ feliz: 0, normal: 0, triste: 0, enojado: 0 }, 0)).toBeNull();
  });

  it('la tasa de respuesta cuenta solo los tickets con la marca de encuesta enviada', async () => {
    const at = '2026-11-10T18:00:00Z';
    const surveys: Survey[] = [
      { ticketId: 'con-marca', rating: 'feliz', createdAt: at },
      // Respuesta sin marca (dato raro): suma a las respuestas, no a la tasa.
      { ticketId: 'sin-marca', rating: 'triste', createdAt: at },
    ];
    const marks = [mark('con-marca', at), mark('enviada-sin-respuesta', at), { ticketId: 'otro', action: 'creado', createdAt: at }];
    const { controller } = setup({ surveys, marks });
    const r: any = await controller.getSurveySummary('2026-11-01', '2026-11-30', TD);
    expect(r).toMatchObject({ total: 2, enviadas: 2, respondidasDeEnviadas: 1, tasaRespuestaPct: 50 });
  });

  it('los tickets borrados no cuentan', async () => {
    const at = '2026-11-10T18:00:00Z';
    const { controller } = setup({
      surveys: [
        { ticketId: 'vivo', rating: 'feliz', createdAt: at },
        { ticketId: 'borrado', rating: 'enojado', createdAt: at },
      ],
      marks: [mark('vivo', at), mark('borrado', at)],
      deleted: ['borrado'],
    });
    const r: any = await controller.getSurveySummary('2026-11-01', '2026-11-30', TD);
    expect(r).toMatchObject({ total: 1, porCalificacion: { feliz: 1, enojado: 0 }, enviadas: 1 });
  });
});

describe('GET /helpdesk/surveys/summary · rango en hora de México', () => {
  it('el día se corta a medianoche de México (UTC-6) y el día final entra completo', async () => {
    const surveys: Survey[] = [
      // 31-oct 23:59 México = 01-nov 05:59Z → fuera
      { ticketId: 'a', rating: 'feliz', createdAt: '2026-11-01T05:59:00Z' },
      // 01-nov 00:00 México → dentro
      { ticketId: 'b', rating: 'feliz', createdAt: '2026-11-01T06:00:00Z' },
      // 30-nov 23:59 México = 01-dic 05:59Z → dentro
      { ticketId: 'c', rating: 'normal', createdAt: '2026-12-01T05:59:00Z' },
      // 01-dic 00:00 México → fuera
      { ticketId: 'd', rating: 'triste', createdAt: '2026-12-01T06:00:00Z' },
    ];
    const { controller, calls } = setup({ surveys });
    const r: any = await controller.getSurveySummary('2026-11-01', '2026-11-30', TD);
    expect(r.total).toBe(2);
    expect(r.porCalificacion).toMatchObject({ feliz: 1, normal: 1, triste: 0 });
    expect((calls[0]![0] as Date).toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect((calls[0]![1] as Date).toISOString()).toBe('2026-12-01T06:00:00.000Z');
  });

  it('un solo día (from = to) cubre ese día completo en México', () => {
    const r = resolveSurveySummaryRange('2026-11-26', '2026-11-26');
    expect(r.start.toISOString()).toBe('2026-11-26T06:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-11-27T06:00:00.000Z');
    expect(startOfDayInZone('2026-07-15').toISOString()).toBe('2026-07-15T06:00:00.000Z');
  });

  it('por defecto: los últimos 30 días hasta hoy en México', () => {
    // 27-nov 03:00Z = 26-nov 21:00 en México: "hoy" es el 26.
    const r = resolveSurveySummaryRange(undefined, undefined, new Date('2026-11-27T03:00:00Z'));
    expect(r).toMatchObject({ from: '2026-10-28', to: '2026-11-26' });
  });

  it('400 si from es posterior a to, si pasa de 366 días o si la fecha no es válida', async () => {
    const { controller } = setup();
    await expect(controller.getSurveySummary('2026-11-30', '2026-11-01', TD)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.getSurveySummary('2025-01-01', '2026-01-02', TD)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.getSurveySummary('2025-11-26', '2026-11-26', TD)).resolves.toBeDefined(); // 366 días
    await expect(controller.getSurveySummary('2026-02-30', '2026-03-01', TD)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(controller.getSurveySummary('26-11-2026', '', TD)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GET /helpdesk/surveys/summary · acceso', () => {
  it('un usuario que no es TD recibe 403 y no se consulta nada', async () => {
    const { controller, calls } = setup();
    expect(() => controller.getSurveySummary('2026-11-01', '2026-11-30', NORMAL)).toThrow(ForbiddenException);
    expect(calls).toHaveLength(0);
  });
});
