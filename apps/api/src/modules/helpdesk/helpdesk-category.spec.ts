import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';

const TD_USER = {
  id: 'u-td',
  name: 'Técnico TD',
  roles: [{ name: 'COLABORADOR', permissions: [{ module: 'tickets.gestion' }] }],
  userPermissions: [],
} as any;
const REQUESTER = { id: 'u-req', name: 'Solicitante', roles: [{ name: 'COLABORADOR', permissions: [] }], userPermissions: [] } as any;

const CATEGORIES: Record<string, any> = {
  equipos: { slug: 'equipos', name: 'Equipos', priorityBase: 'P2', isActive: true },
  software: { slug: 'software', name: 'Software', priorityBase: 'P3', isActive: true },
  vieja: { slug: 'vieja', name: 'Vieja', priorityBase: 'P4', isActive: false },
};
const SUBS = [
  { categorySlug: 'software', name: 'Office', isActive: true },
  { categorySlug: 'equipos', name: 'Laptop', isActive: true },
];

function setup(over: Record<string, unknown> = {}) {
  const ticket: any = {
    id: 'tk-1',
    displayId: 'TIC-2026-030',
    requesterId: 'u-req',
    category: 'equipos',
    subcategory: 'Laptop',
    priority: 'P2',
    status: 'en_atencion',
    ...over,
  };
  const history: any[] = [];
  const notifications: any[] = [];
  const service = Object.create(HelpdeskService.prototype) as any;
  const ticketRepo = { save: async (t: any) => t };
  service.ticketsRepo = {
    findOne: async () => ticket,
    manager: {
      transaction: async (cb: any) =>
        cb({
          getRepository: (entity: any) =>
            entity.name === 'Ticket'
              ? ticketRepo
              : { create: (x: any) => x, save: async (rows: any[]) => history.push(...rows) },
        }),
    },
  };
  service.categoriesRepo = { findOne: async ({ where }: any) => CATEGORIES[where.slug] ?? null };
  service.subcategoriesRepo = {
    findOne: async ({ where }: any) =>
      SUBS.find((s) => s.categorySlug === where.categorySlug && s.name === where.name && s.isActive) ?? null,
  };
  service.notificationsService = { create: async (n: any) => notifications.push(n) };
  service.notificationFlows = { notify: async (...a: any[]) => notifications.push(a) };
  return { service: service as HelpdeskService, ticket, history, notifications };
}

describe('PATCH /helpdesk/tickets/:id/category', () => {
  it('el técnico cambia categoría y subcategoría y queda en el historial (quién, anterior y nuevo)', async () => {
    const { service, ticket, history, notifications } = setup();
    await service.changeCategory('tk-1', { category: 'software', subcategory: 'Office' }, TD_USER);
    expect(ticket).toMatchObject({ category: 'software', subcategory: 'Office' });
    expect(history[0]).toMatchObject({
      action: 'categoria_cambiada',
      userId: 'u-td',
      userName: 'Técnico TD',
      oldValue: 'Equipos / Laptop',
      newValue: 'Software / Office',
    });
    expect(notifications).toHaveLength(0); // no se avisa al solicitante
  });

  it('un usuario normal (el solicitante) recibe 403 y el servicio no se toca', () => {
    const service = { changeCategory: jest.fn() } as any;
    const controller = new HelpdeskController(service);
    expect(() => controller.changeCategory('tk-1', { category: 'software' }, REQUESTER)).toThrow(ForbiddenException);
    expect(service.changeCategory).not.toHaveBeenCalled();
    controller.changeCategory('tk-1', { category: 'software' }, TD_USER);
    expect(service.changeCategory).toHaveBeenCalled();
  });

  it('prioridad igual a la base de la categoría anterior: se recalcula con la nueva y se registra', async () => {
    const { service, ticket, history } = setup({ priority: 'P2' }); // base de equipos = P2
    await service.changeCategory('tk-1', { category: 'software' }, TD_USER);
    expect(ticket.priority).toBe('P3');
    expect(history.map((h) => h.action)).toEqual(['categoria_cambiada', 'actualizado.priority']);
    expect(history[1]).toMatchObject({ oldValue: 'P2', newValue: 'P3' });
  });

  it('prioridad cambiada a mano (distinta de la base anterior): no se toca', async () => {
    const { service, ticket, history } = setup({ priority: 'P1' });
    await service.changeCategory('tk-1', { category: 'software' }, TD_USER);
    expect(ticket.priority).toBe('P1');
    expect(history.map((h) => h.action)).toEqual(['categoria_cambiada']);
  });

  it('solo cambiar la subcategoría no recalcula la prioridad', async () => {
    const { service, ticket, history } = setup({ subcategory: null });
    await service.changeCategory('tk-1', { category: 'equipos', subcategory: 'Laptop' }, TD_USER);
    expect(ticket.priority).toBe('P2');
    expect(history).toEqual([expect.objectContaining({ oldValue: 'Equipos', newValue: 'Equipos / Laptop' })]);
  });

  it('cambiar de categoría sin subcategoría la deja vacía', async () => {
    const { service, ticket } = setup();
    await service.changeCategory('tk-1', { category: 'software' }, TD_USER);
    expect(ticket.subcategory).toBeNull();
  });

  it('categoría inexistente o desactivada, o subcategoría ajena: 400 sin cambios', async () => {
    for (const dto of [
      { category: 'no-existe' },
      { category: 'vieja' },
      { category: 'software', subcategory: 'Laptop' },
    ]) {
      const { service, ticket, history } = setup();
      await expect(service.changeCategory('tk-1', dto, TD_USER)).rejects.toBeInstanceOf(BadRequestException);
      expect(ticket.category).toBe('equipos');
      expect(history).toHaveLength(0);
    }
  });

  it('sin cambio real no escribe historial', async () => {
    const { service, history } = setup();
    await service.changeCategory('tk-1', { category: 'equipos', subcategory: 'Laptop' }, TD_USER);
    expect(history).toHaveLength(0);
  });
});
