import 'reflect-metadata';
import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { HelpdeskService } from './helpdesk.service';

const ASSIGNEE = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

/** Servicio con un QueryBuilder falso: interesa qué condiciones se arman. */
function setup() {
  const wheres: { sql: string; params?: Record<string, unknown> }[] = [];
  const qb: any = {
    where: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    take: () => qb,
    andWhere: (sql: string, params?: Record<string, unknown>) => {
      wheres.push({ sql, ...(params ? { params } : {}) });
      return qb;
    },
    getMany: async () => [],
  };
  const service = Object.create(HelpdeskService.prototype) as any;
  service.ticketsRepo = { createQueryBuilder: () => qb };
  service.assigneesRepo = { findBy: async () => [] };
  return { service: service as HelpdeskService, wheres };
}

const sqls = (w: { sql: string }[]) => w.map((x) => x.sql);

describe('Tickets · filtro por asignado', () => {
  it('por persona: t.assigned_to = :assignedTo con el UUID', async () => {
    const { service, wheres } = setup();
    await service.findAll({ assignedTo: ASSIGNEE }, true, USER);
    const w = wheres.find((x) => x.sql.includes('t.assigned_to ='));
    expect(w?.params).toEqual({ assignedTo: ASSIGNEE });
  });

  it('"sin_asignar": t.assigned_to IS NULL', async () => {
    const { service, wheres } = setup();
    await service.findAll({ assignedTo: 'sin_asignar' }, true, USER);
    expect(sqls(wheres)).toContain('t.assigned_to IS NULL');
    expect(sqls(wheres).some((s) => s.includes('t.assigned_to ='))).toBe(false);
  });

  it('sin filtro no agrega ninguna condición de asignado', async () => {
    const { service, wheres } = setup();
    await service.findAll({}, true, USER);
    expect(sqls(wheres).some((s) => s.includes('assigned_to'))).toBe(false);
  });

  it('se combina con AND con los demás filtros', async () => {
    const { service, wheres } = setup();
    await service.findAll({ assignedTo: ASSIGNEE, status: 'abierto', priority: 'P1', category: 'equipos', search: 'laptop' }, true, USER);
    const all = sqls(wheres).join(' | ');
    for (const part of ['t.status =', 't.priority =', 't.category =', 't.assigned_to =', 't.display_id ILIKE']) {
      expect(all).toContain(part);
    }
  });

  it('no amplía la visibilidad: un usuario sin rol TD sigue restringido a sus propios tickets', async () => {
    const { service, wheres } = setup();
    await service.findAll({ assignedTo: 'sin_asignar' }, false, USER);
    expect(wheres.find((x) => x.sql.includes('t.requester_id'))?.params).toEqual({ uid: USER });
    expect(sqls(wheres)).toContain('t.assigned_to IS NULL');
  });

  it('el filtro por SLA del API sigue funcionando aunque la pantalla ya no lo envíe', async () => {
    const { service, wheres } = setup();
    await service.findAll({ slaStatus: 'overdue' }, true, USER);
    expect(sqls(wheres).some((s) => s.includes('NOT IN'))).toBe(true);
  });
});

describe('QueryTicketsDto · assignedTo', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta: ArgumentMetadata = { type: 'query', metatype: QueryTicketsDto };

  it('acepta un UUID, el valor reservado sin_asignar y la ausencia del filtro', async () => {
    await expect(pipe.transform({ assignedTo: ASSIGNEE }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({ assignedTo: 'sin_asignar' }, meta)).resolves.toBeDefined();
    await expect(pipe.transform({}, meta)).resolves.toBeDefined();
  });

  it('rechaza cualquier otro texto (incluida una inyección)', async () => {
    await expect(pipe.transform({ assignedTo: 'Daniel Ortiz' }, meta)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ assignedTo: "x' OR 1=1 --" }, meta)).rejects.toThrow(BadRequestException);
  });

  it('el API no ofrece orden de servidor: un parámetro de orden arbitrario del cliente se rechaza', async () => {
    await expect(pipe.transform({ sortBy: 'requested_at; DROP TABLE x' }, meta)).rejects.toThrow(BadRequestException);
    await expect(pipe.transform({ orderBy: 'assignedTo' }, meta)).rejects.toThrow(BadRequestException);
  });
});
