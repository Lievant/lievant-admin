import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { HelpdeskService } from './helpdesk.service';

/**
 * QueryBuilder SIMULADO: cada condición que arma findAll se traduce aquí a un
 * predicado sobre filas en memoria (ticket + encuesta del LEFT JOIN + marca de
 * enviada). Valida qué condiciones se combinan, el orden, el límite y el mapeo
 * de la columna; NO valida el SQL contra PostgreSQL (eso se prueba en staging).
 * Si findAll arma una condición que el simulador no conoce, la prueba truena.
 */
interface Row {
  id: string;
  requestedAt: Date;
  status: string;
  priority: string | null;
  deletedAt: Date | null;
  assignedTo: string | null;
  rating: string | null; // helpdesk.ticket_surveys.rating (LEFT JOIN)
  sent: boolean; // marca encuesta_solicitada en el historial
}

const SENT_SQL =
  'EXISTS (SELECT 1 FROM helpdesk.ticket_history sh WHERE sh.ticket_id = t.id AND sh.action = :surveyRequested)';
const CURSOR_SQL = '(t.requested_at < :cd OR (t.requested_at = :cd AND t.id < :ci))';

function fakeQb(rows: Row[]) {
  const preds: ((r: Row) => boolean)[] = [];
  const calls = {
    leftJoin: [] as string[],
    addSelect: [] as string[],
    limit: 0,
    take: 0,
    params: {} as Record<string, unknown>,
  };
  let joined = false;
  const p = calls.params;
  const translate = (sql: string): ((r: Row) => boolean) => {
    if (sql === 't.deleted_at IS NULL') return (r) => !r.deletedAt;
    if (sql === 't.requester_id = :uid') return () => true;
    if (sql === 't.status = :status') return (r) => r.status === p.status;
    if (sql === 't.priority = :priority') return (r) => r.priority === p.priority;
    if (sql === 'srv.rating = :satisfaction') return (r) => r.rating === p.satisfaction;
    if (sql === 'srv.id IS NULL') return (r) => r.rating === null;
    if (sql === SENT_SQL) return (r) => p.surveyRequested === 'encuesta_solicitada' && r.sent;
    if (sql === CURSOR_SQL) {
      return (r) => {
        const cd = new Date(String(p.cd)).getTime();
        return r.requestedAt.getTime() < cd || (r.requestedAt.getTime() === cd && r.id < String(p.ci));
      };
    }
    throw new Error(`Condición no simulada: ${sql}`);
  };
  const qb: any = {
    where: (sql: string) => (preds.push(translate(sql)), qb),
    andWhere: (sql: string, params?: Record<string, unknown>) => {
      Object.assign(p, params ?? {});
      preds.push(translate(sql));
      return qb;
    },
    orderBy: () => qb,
    addOrderBy: () => qb,
    limit: (n: number) => ((calls.limit = n), qb),
    take: (n: number) => ((calls.take = n), qb),
    leftJoin: (_e: unknown, alias: string, cond: string) => {
      joined = true;
      calls.leftJoin.push(`${alias} ON ${cond}`);
      return qb;
    },
    addSelect: (_sel: string, alias: string) => (calls.addSelect.push(alias), qb),
    setParameter: (k: string, v: unknown) => ((p[k] = v), qb),
    getRawAndEntities: async () => {
      const hit = rows
        .filter((r) => preds.every((f) => f(r)))
        .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime() || (a.id < b.id ? 1 : -1))
        .slice(0, calls.limit || undefined);
      return {
        entities: hit.map((r) => ({
          id: r.id,
          displayId: r.id,
          requestedAt: r.requestedAt,
          status: r.status,
          priority: r.priority,
          assignedTo: r.assignedTo,
        })),
        raw: hit.map((r) => ({ t_id: r.id, ...(joined ? { survey_rating: r.rating, survey_sent: r.sent } : {}) })),
      };
    },
  };
  return { qb, calls };
}

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 12));
const row = (id: string, n: number, over: Partial<Row>): Row => ({
  id,
  requestedAt: day(n),
  status: 'cerrado',
  priority: 'P2',
  deletedAt: null,
  assignedTo: null,
  rating: null,
  sent: false,
  ...over,
});
const ROWS: Row[] = [
  row('a', 20, { rating: 'feliz', sent: true }),
  row('b', 19, { rating: 'feliz', sent: true, priority: 'P3' }),
  row('c', 18, { rating: 'enojado', sent: true }),
  row('d', 17, { sent: true }), // enviada, sin respuesta
  row('e', 16, {}), // cerrado antes de la encuesta: nunca tuvo
  row('f', 15, { status: 'abierto' }),
  row('g', 14, { rating: 'feliz', sent: true }),
  row('h', 13, { rating: 'feliz', sent: true, deletedAt: new Date() }), // borrado
];

function setup(rows: Row[] = ROWS) {
  const { qb, calls } = fakeQb(rows);
  const service = Object.create(HelpdeskService.prototype) as any;
  service.ticketsRepo = { createQueryBuilder: () => qb };
  service.assigneesRepo = { findBy: async () => [] };
  return { service: service as HelpdeskService, calls };
}

const ids = (page: { data: { id: string }[] }) => page.data.map((t) => t.id);

describe('Lista de TD · columna Satisfacción', () => {
  it('un solo LEFT JOIN a ticket_surveys, sin take (sin consulta extra de ids)', async () => {
    const { service, calls } = setup();
    await service.findAll({ limit: 20 }, true, 'u-td');
    expect(calls.leftJoin).toEqual(['srv ON srv.ticket_id = t.id']);
    expect(calls.addSelect).toEqual(['survey_rating', 'survey_sent']);
    expect(calls.take).toBe(0);
    expect(calls.limit).toBe(21);
  });

  it('calificación, "sin_responder" (enviada sin respuesta) o null (nunca tuvo encuesta)', async () => {
    const { service } = setup();
    const page: any = await service.findAll({ limit: 20 }, true, 'u-td');
    const byId = Object.fromEntries(page.data.map((t: any) => [t.id, t.satisfaction]));
    expect(byId).toEqual({ a: 'feliz', b: 'feliz', c: 'enojado', d: 'sin_responder', e: null, f: null, g: 'feliz' });
  });

  it('quien no es TD no recibe la columna ni se hace el JOIN, y el filtro se ignora', async () => {
    const { service, calls } = setup();
    const page: any = await service.findAll({ limit: 20, satisfaction: 'feliz' }, false, 'u-req');
    expect(calls.leftJoin).toEqual([]);
    expect(page.data.every((t: any) => !('satisfaction' in t))).toBe(true);
    expect(ids(page)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});

describe('Lista de TD · filtro de satisfacción', () => {
  it('devuelve solo los tickets con esa calificación', async () => {
    expect(ids(await setup().service.findAll({ satisfaction: 'feliz' }, true, 'u-td'))).toEqual(['a', 'b', 'g']);
    expect(ids(await setup().service.findAll({ satisfaction: 'enojado' }, true, 'u-td'))).toEqual(['c']);
    expect(ids(await setup().service.findAll({ satisfaction: 'triste' }, true, 'u-td'))).toEqual([]);
  });

  it('"Sin responder" excluye los que nunca tuvieron encuesta', async () => {
    const page: any = await setup().service.findAll({ satisfaction: 'sin_responder' }, true, 'u-td');
    expect(ids(page)).toEqual(['d']);
    expect(page.data[0].satisfaction).toBe('sin_responder');
  });

  it('combinado con otro filtro (prioridad)', async () => {
    expect(ids(await setup().service.findAll({ satisfaction: 'feliz', priority: 'P2' }, true, 'u-td'))).toEqual([
      'a',
      'g',
    ]);
  });

  it('con paginación: las páginas no repiten ni pierden tickets y el cursor sigue filtrando', async () => {
    const p1: any = await setup().service.findAll({ satisfaction: 'feliz', limit: 2 }, true, 'u-td');
    expect(ids(p1)).toEqual(['a', 'b']);
    expect(p1.nextCursor).toBeTruthy();
    const p2: any = await setup().service.findAll(
      { satisfaction: 'feliz', limit: 2, cursor: p1.nextCursor },
      true,
      'u-td',
    );
    expect(ids(p2)).toEqual(['g']);
    expect(p2.nextCursor).toBeNull();
  });

  it('el DTO solo acepta las calificaciones y sin_responder', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const meta: ArgumentMetadata = { type: 'query', metatype: QueryTicketsDto };
    for (const v of ['feliz', 'normal', 'triste', 'enojado', 'sin_responder']) {
      await expect(pipe.transform({ satisfaction: v }, meta)).resolves.toMatchObject({ satisfaction: v });
    }
    await expect(pipe.transform({ satisfaction: 'contento' }, meta)).rejects.toBeInstanceOf(BadRequestException);
  });
});
