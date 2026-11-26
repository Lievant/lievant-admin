import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { HelpdeskService } from './helpdesk.service';
// Lógica pura de la pantalla "Mis tickets" (frontend): se prueba aquí con el API.
import {
  attentionTime,
  formatDuration,
  slaStatus,
} from '../../../../web/src/app/(dashboard)/herramientas/soporte/ticket-sla';

const OWNER = 'u-owner';
const OTHER = 'u-other';

function ticket(over: Record<string, unknown> = {}) {
  return {
    id: 'tk-1',
    displayId: 'TIC-2026-020',
    requesterId: OWNER,
    category: 'equipos',
    subcategory: 'Laptop',
    description: 'La laptop no enciende desde esta mañana.',
    priority: 'P2',
    status: 'cerrado',
    requestedAt: new Date('2026-11-25T09:00:00Z'),
    resolvedAt: new Date('2026-11-25T11:00:00Z'),
    closedAt: new Date('2026-11-25T11:15:00Z'),
    assignedTo: 'as-1',
    equipmentId: 'MA053',
    diagnosis: 'Fuente dañada (diagnóstico interno)',
    solution: 'Se cambió la fuente de poder.',
    internalNotes: 'NOTA-INTERNA: el usuario tiró café',
    deletedAt: null,
    ...over,
  };
}

function setup(row: any) {
  const service = Object.create(HelpdeskService.prototype) as any;
  service.ticketsRepo = { findOne: async () => row };
  service.categoriesRepo = {
    find: async () => [{ slug: 'equipos', name: 'Equipos', slaResolutionHours: 8 }],
  };
  service.assigneesRepo = { findOne: async () => ({ id: 'as-1', name: 'Técnico Uno' }) };
  service.surveysRepo = { findOne: async () => null };
  service.historyRepo = { count: async () => 1 };
  return service as HelpdeskService;
}

describe('GET /helpdesk/tickets/my/:id', () => {
  it('el solicitante ve su ticket con notas de solución, técnico, equipo y fechas', async () => {
    const detail = await setup(ticket()).findMyTicketDetail(OWNER, 'tk-1');
    expect(detail).toMatchObject({
      survey: null,
      canAnswerSurvey: true,
      displayId: 'TIC-2026-020',
      categoryName: 'Equipos',
      subcategory: 'Laptop',
      solution: 'Se cambió la fuente de poder.',
      assigneeName: 'Técnico Uno',
      equipmentId: 'MA053',
      slaResolutionHours: 8,
    });
  });

  it('las notas internas, problem_status y el historial no salen', async () => {
    const detail = await setup(ticket({ problemStatus: 'PS-INTERNO' })).findMyTicketDetail(OWNER, 'tk-1');
    expect(detail).not.toHaveProperty('internalNotes');
    expect(detail).not.toHaveProperty('problemStatus');
    expect(detail).not.toHaveProperty('history');
    expect(JSON.stringify(detail)).not.toMatch(/NOTA-INTERNA|PS-INTERNO/);
  });

  it.each(['abierto', 'en_atencion', 'en_revision', 'cancelado'])(
    'con el ticket %s el diagnóstico no sale',
    async (status: string) => {
      const detail = await setup(ticket({ status, closedAt: null })).findMyTicketDetail(OWNER, 'tk-1');
      expect(detail).not.toHaveProperty('diagnosis');
      expect(JSON.stringify(detail)).not.toMatch(/diagnóstico interno/);
    },
  );

  it.each(['resuelto', 'cerrado'])('con el ticket %s el diagnóstico sale junto a la solución', async (status: string) => {
    const detail = await setup(ticket({ status })).findMyTicketDetail(OWNER, 'tk-1');
    expect(detail).toMatchObject({
      diagnosis: 'Fuente dañada (diagnóstico interno)',
      solution: 'Se cambió la fuente de poder.',
    });
    expect(detail).not.toHaveProperty('internalNotes');
  });

  it('resuelto sin diagnóstico escrito: no hay sección', async () => {
    for (const diagnosis of [null, '', '   ']) {
      const detail = await setup(ticket({ diagnosis })).findMyTicketDetail(OWNER, 'tk-1');
      expect(detail).not.toHaveProperty('diagnosis');
    }
  });

  it('el detalle de un ticket ajeno se rechaza (404, sin decir si existe)', async () => {
    await expect(setup(ticket()).findMyTicketDetail(OTHER, 'tk-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un ticket inexistente o borrado también es 404', async () => {
    await expect(setup(null).findMyTicketDetail(OWNER, 'tk-x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup(ticket({ deletedAt: new Date() })).findMyTicketDetail(OWNER, 'tk-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('Tiempo de atención (apertura → cierre, tiempo corrido)', () => {
  it.each([
    [2 * 3600_000 + 15 * 60_000, '2 h 15 min'],
    [3 * 86400_000 + 4 * 3600_000, '3 d 4 h'],
    [45 * 60_000, '45 min'],
    [5 * 3600_000, '5 h'],
    [2 * 86400_000, '2 d'],
    [30_000, 'menos de 1 min'],
  ])('%p ms → %p', (ms, label) => {
    expect(formatDuration(ms)).toBe(label);
  });

  it('se calcula de la apertura al cierre y solo para tickets cerrados', () => {
    const base = { requestedAt: '2026-11-25T09:00:00Z', closedAt: '2026-11-25T11:15:00Z' };
    expect(attentionTime({ ...base, status: 'cerrado' })).toBe('2 h 15 min');
    // Cruza fin de semana: corrido, sin horario hábil.
    expect(attentionTime({ status: 'cerrado', requestedAt: '2026-11-20T18:00:00Z', closedAt: '2026-11-23T22:00:00Z' })).toBe(
      '3 d 4 h',
    );
    expect(attentionTime({ ...base, status: 'en_atencion' })).toBeNull();
    expect(attentionTime({ status: 'cerrado', requestedAt: base.requestedAt, closedAt: null })).toBeNull();
  });
});

describe('SLA contra la meta de resolución de la categoría', () => {
  const opened = '2026-11-26T08:00:00Z';
  const at = (iso: string) => new Date(iso).getTime();

  it('abierto: A tiempo, Vence en …, Vencido', () => {
    const t = { status: 'abierto', requestedAt: opened, closedAt: null, slaResolutionHours: 8 };
    expect(slaStatus(t, at('2026-11-26T10:00:00Z'))).toEqual({ label: 'A tiempo', tone: 'ok' });
    expect(slaStatus(t, at('2026-11-26T14:30:00Z'))).toEqual({ label: 'Vence en 1 h 30 min', tone: 'warning' });
    expect(slaStatus(t, at('2026-11-26T16:00:00Z'))).toEqual({ label: 'Vencido', tone: 'overdue' });
  });

  it('cerrado: Cumplido o Fuera de SLA', () => {
    const t = { status: 'cerrado', requestedAt: opened, slaResolutionHours: 8 };
    expect(slaStatus({ ...t, closedAt: '2026-11-26T15:59:00Z' })).toEqual({ label: 'Cumplido', tone: 'met' });
    expect(slaStatus({ ...t, closedAt: '2026-11-26T16:01:00Z' })).toEqual({ label: 'Fuera de SLA', tone: 'missed' });
  });

  it('resuelto esperando confirmación: el reloj se detiene en la resolución', () => {
    const t = { status: 'resuelto', requestedAt: opened, resolvedAt: '2026-11-26T09:00:00Z', closedAt: null, slaResolutionHours: 8 };
    expect(slaStatus(t, at('2026-11-30T00:00:00Z'))).toEqual({ label: 'Cumplido', tone: 'met' });
  });

  it('categoría sin meta (nula o 0) y cancelados no muestran semáforo', () => {
    expect(slaStatus({ status: 'abierto', requestedAt: opened, closedAt: null, slaResolutionHours: null }).tone).toBe('none');
    expect(slaStatus({ status: 'abierto', requestedAt: opened, closedAt: null, slaResolutionHours: 0 }).label).toBe('Sin meta');
    expect(slaStatus({ status: 'cancelado', requestedAt: opened, closedAt: null, slaResolutionHours: 8 }).label).toBe('—');
  });
});
