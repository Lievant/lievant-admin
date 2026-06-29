import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { HelpdeskCategory } from './entities/category.entity';
import { HelpdeskSubcategory } from './entities/subcategory.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketAssignee } from './entities/ticket-assignee.entity';
import { TicketHistory } from './entities/ticket-history.entity';

const CATEGORY_PRIORITY: Record<string, string> = {
  conectividad: 'P1',
  infraestructura: 'P1',
  seguridad: 'P1',
  equipos: 'P2',
  accesos: 'P3',
  software: 'P3',
  correo: 'P3',
  mejora: 'P4',
};

// Seconds per SLA hour-limit (for inline CASE expression)
const SLA_SECONDS: Record<string, number> = { P1: 14400, P2: 28800, P3: 86400, P4: 259200 };

@Injectable()
export class HelpdeskService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(TicketAssignee) private readonly assigneesRepo: Repository<TicketAssignee>,
    @InjectRepository(TicketHistory) private readonly historyRepo: Repository<TicketHistory>,
    @InjectRepository(HelpdeskCategory) private readonly categoriesRepo: Repository<HelpdeskCategory>,
    @InjectRepository(HelpdeskSubcategory) private readonly subcategoriesRepo: Repository<HelpdeskSubcategory>,
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
  ) {}

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  async findAll(query: QueryTicketsDto, isTd: boolean, currentUserId?: string) {
    const limit = query.limit ?? 20;
    const qb = this.ticketsRepo
      .createQueryBuilder('t')
      .where('t.deleted_at IS NULL')
      .orderBy('t.requested_at', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .take(limit + 1);

    if (!isTd && currentUserId) {
      qb.andWhere('t.requester_id = :uid', { uid: currentUserId });
    }
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.area) qb.andWhere('t.requester_area ILIKE :area', { area: `%${query.area}%` });
    if (query.assignedTo) qb.andWhere('t.assigned_to = :assignedTo', { assignedTo: query.assignedTo });
    if (query.search) {
      qb.andWhere(
        '(t.display_id ILIKE :s OR t.requester_name ILIKE :s OR t.description ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.dateFrom) qb.andWhere('t.requested_at >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('t.requested_at <= :dateTo', { dateTo: query.dateTo });
    if (query.slaStatus) {
      const slaRatio = `CASE
        WHEN t.priority = 'P1' THEN EXTRACT(EPOCH FROM (NOW() - t.requested_at)) / ${SLA_SECONDS['P1']}.0
        WHEN t.priority = 'P2' THEN EXTRACT(EPOCH FROM (NOW() - t.requested_at)) / ${SLA_SECONDS['P2']}.0
        WHEN t.priority = 'P3' THEN EXTRACT(EPOCH FROM (NOW() - t.requested_at)) / ${SLA_SECONDS['P3']}.0
        WHEN t.priority = 'P4' THEN EXTRACT(EPOCH FROM (NOW() - t.requested_at)) / ${SLA_SECONDS['P4']}.0
        ELSE NULL END`;
      qb.andWhere(`t.status NOT IN ('cerrado', 'cancelado')`);
      if (query.slaStatus === 'overdue') {
        qb.andWhere(`(${slaRatio}) >= 1.0`);
      } else if (query.slaStatus === 'warning') {
        qb.andWhere(`(${slaRatio}) >= 0.75`).andWhere(`(${slaRatio}) < 1.0`);
      } else {
        qb.andWhere(`(${slaRatio}) < 0.75`);
      }
    }
    if (query.cursor) {
      const [cursorDate = '', cursorId = ''] = Buffer.from(query.cursor, 'base64').toString().split('|');
      qb.andWhere(
        '(t.requested_at < :cd OR (t.requested_at = :cd AND t.id < :ci))',
        { cd: cursorDate, ci: cursorId },
      );
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(`${last.requestedAt.toISOString()}|${last.id}`).toString('base64')
        : null;

    const assigneeIds = [...new Set(data.filter((t) => t.assignedTo).map((t) => t.assignedTo!))];
    const assigneeMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const assignees = await this.assigneesRepo.findBy({ id: In(assigneeIds) });
      for (const a of assignees) assigneeMap[a.id] = a.name;
    }
    const enriched = data.map((t) => ({ ...t, assigneeName: assigneeMap[t.assignedTo ?? ''] ?? null }));

    return { data: enriched, nextCursor, total: enriched.length };
  }

  async findById(id: string) {
    const ticket = await this.ticketsRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} no encontrado`);
    const [history, assignee] = await Promise.all([
      this.historyRepo.find({ where: { ticketId: id }, order: { createdAt: 'ASC' } }),
      ticket.assignedTo
        ? this.assigneesRepo.findOne({ where: { id: ticket.assignedTo } })
        : Promise.resolve(null),
    ]);
    return { ...ticket, history, assigneeName: assignee?.name ?? null };
  }

  async findMyTickets(userId: string, query: QueryTicketsDto) {
    return this.findAll(query, false, userId);
  }

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  async create(dto: CreateTicketDto, user: User) {
    const year = new Date().getFullYear();
    const [last, employee] = await Promise.all([
      this.ticketsRepo.findOne({
        where: { displayId: Like(`TIC-${year}-%`) },
        order: { displayId: 'DESC' },
      }),
      this.employeesRepo.findOne({ where: { authUserId: user.id } }),
    ]);
    const seq = last ? parseInt(last.displayId.split('-').at(2) ?? '0', 10) + 1 : 1;
    const displayId = `TIC-${year}-${String(seq).padStart(3, '0')}`;

    const priority = CATEGORY_PRIORITY[dto.category] ?? 'P3';
    const requesterName = employee?.fullName ?? user.name;
    const requesterArea = employee?.area ?? employee?.division ?? null;

    const ticket = this.ticketsRepo.create({
      displayId,
      requesterId: user.id,
      requesterName,
      requesterArea,
      openedByTd: dto.openedByTd ?? false,
      openedOnBehalfOf: dto.openedOnBehalfOf ?? null,
      behalfReason: dto.behalfReason ?? null,
      category: dto.category,
      subcategory: dto.subcategory ?? null,
      equipmentId: dto.equipmentId ?? null,
      description: dto.description,
      impact: dto.impact,
      priority,
      assignedTo: dto.assignedTo ?? null,
      status: 'abierto',
      estimatedDelivery: dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : null,
    });

    const saved = await this.ticketsRepo.save(ticket);
    await this.addHistory(saved.id, user, 'creado', null, 'abierto');
    return saved;
  }

  async updateStatus(id: string, dto: UpdateTicketStatusDto, user: User) {
    const ticket = await this.getOrFail(id);
    const oldStatus = ticket.status;
    const now = new Date();

    ticket.status = dto.status;
    if (dto.status === 'en_atencion' && !ticket.firstResponseAt) ticket.firstResponseAt = now;
    if (dto.status === 'resuelto' && !ticket.resolvedAt) ticket.resolvedAt = now;
    if (dto.status === 'cerrado' && !ticket.closedAt) {
      ticket.closedAt = now;
      if (ticket.requestedAt) {
        ticket.resolutionHours = String(
          ((now.getTime() - ticket.requestedAt.getTime()) / 3_600_000).toFixed(2),
        );
      }
    }
    if (dto.status === 'abierto' && oldStatus !== 'abierto') {
      ticket.timesReopened = (ticket.timesReopened ?? 0) + 1;
    }

    await this.ticketsRepo.save(ticket);
    await this.addHistory(id, user, 'estado_cambiado', oldStatus, dto.status, dto.notes);
    return ticket;
  }

  async updateTicket(id: string, dto: UpdateTicketDto, user: User) {
    const ticket = await this.getOrFail(id);
    const fields: Array<keyof UpdateTicketDto> = [
      'priority', 'assignedTo', 'diagnosis', 'solution',
      'internalNotes', 'problemStatus', 'subcategory',
      'collaboratorConfirmation',
    ];

    for (const field of fields) {
      if (dto[field] !== undefined) {
        const ticketMap = ticket as unknown as Record<string, unknown>;
        const old = String(ticketMap[field] ?? '');
        const next = String(dto[field]);
        if (old !== next) {
          ticketMap[field] = dto[field];
          await this.addHistory(id, user, `actualizado.${field}`, old || null, next);
        }
      }
    }
    if (dto.estimatedDelivery !== undefined) {
      ticket.estimatedDelivery = dto.estimatedDelivery ? new Date(dto.estimatedDelivery) : null;
    }

    return this.ticketsRepo.save(ticket);
  }

  async escalate(id: string, dto: EscalateTicketDto, user: User) {
    const ticket = await this.getOrFail(id);
    ticket.escalatedTo = dto.escalateTo;
    ticket.escalationReason = dto.reason;
    await this.ticketsRepo.save(ticket);
    await this.addHistory(id, user, 'escalado', null, dto.escalateTo, dto.reason);
    return ticket;
  }

  // -----------------------------------------------------------------------
  // Stats & Dashboard
  // -----------------------------------------------------------------------

  async getStats(from?: string, to?: string) {
    const hasFilter = Boolean(from && to);
    const base = `WHERE deleted_at IS NULL`;
    const dateClause = hasFilter ? `AND requested_at >= $1 AND requested_at <= $2` : '';
    const params: string[] = hasFilter ? [from!, to!] : [];

    // Previous period params (same duration before `from`)
    let prevClause = `AND 1=0`;
    let prevParams: string[] = [];
    if (hasFilter) {
      const f = new Date(from!);
      const t = new Date(to!);
      const span = t.getTime() - f.getTime();
      const pFrom = new Date(f.getTime() - span).toISOString();
      const pTo = new Date(f.getTime() - 1).toISOString();
      prevClause = `AND requested_at >= $1 AND requested_at <= $2`;
      prevParams = [pFrom, pTo];
    }

    const [
      byStatus, byPriority, slaData, avgRes, openRows, byCategory, byMonth, top10,
      prevTotal, prevSlaData, prevAvgRes,
    ] = await Promise.all([
      this.ticketsRepo.manager.query<Array<{ status: string; count: number }>>(
        `SELECT status, COUNT(*)::int AS count FROM helpdesk.tickets ${base} ${dateClause} GROUP BY status`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ priority: string; count: number }>>(
        `SELECT priority, COUNT(*)::int AS count FROM helpdesk.tickets ${base} ${dateClause} AND priority IS NOT NULL GROUP BY priority`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ total: string; resolution_met: string }>>(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE sla_resolution_met = true)::int AS resolution_met FROM helpdesk.tickets ${base} ${dateClause} AND sla_resolution_met IS NOT NULL`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ avg_hours: string }>>(
        `SELECT ROUND(AVG(resolution_hours)::numeric, 2) AS avg_hours FROM helpdesk.tickets ${base} ${dateClause} AND resolution_hours IS NOT NULL`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::int AS count FROM helpdesk.tickets ${base} ${dateClause} AND status IN ('abierto', 'en_atencion', 'en_revision')`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ category: string; count: number }>>(
        `SELECT category, COUNT(*)::int AS count FROM helpdesk.tickets ${base} ${dateClause} GROUP BY category ORDER BY count DESC`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ month: string; count: number }>>(
        `SELECT TO_CHAR(DATE_TRUNC('month', requested_at), 'YYYY-MM') AS month, COUNT(*)::int AS count FROM helpdesk.tickets WHERE deleted_at IS NULL AND requested_at >= DATE_TRUNC('month', NOW()) - INTERVAL '6 months' GROUP BY month ORDER BY month`,
      ),
      this.ticketsRepo.manager.query<Array<{ requester_name: string; count: number }>>(
        `SELECT requester_name, COUNT(*)::int AS count FROM helpdesk.tickets ${base} ${dateClause} GROUP BY requester_name ORDER BY count DESC LIMIT 10`,
        params,
      ),
      this.ticketsRepo.manager.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::int AS count FROM helpdesk.tickets ${base} ${prevClause}`,
        prevParams,
      ),
      this.ticketsRepo.manager.query<Array<{ total: string; resolution_met: string }>>(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE sla_resolution_met = true)::int AS resolution_met FROM helpdesk.tickets ${base} ${prevClause} AND sla_resolution_met IS NOT NULL`,
        prevParams,
      ),
      this.ticketsRepo.manager.query<Array<{ avg_hours: string }>>(
        `SELECT ROUND(AVG(resolution_hours)::numeric, 2) AS avg_hours FROM helpdesk.tickets ${base} ${prevClause} AND resolution_hours IS NOT NULL`,
        prevParams,
      ),
    ]);

    const total = byStatus.reduce((s, r) => s + Number(r.count), 0);
    const sla = slaData[0];
    const slaRate =
      sla && Number(sla.total) > 0
        ? Math.round((Number(sla.resolution_met) / Number(sla.total)) * 100)
        : null;

    const prevSla = prevSlaData[0];
    const prevSlaRate =
      prevSla && Number(prevSla.total) > 0
        ? Math.round((Number(prevSla.resolution_met) / Number(prevSla.total)) * 100)
        : null;

    return {
      total,
      openTickets: Number(openRows[0]?.count ?? 0),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, Number(r.count)])),
      byCategory: Object.fromEntries(byCategory.map((r) => [r.category, Number(r.count)])),
      byMonth: byMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
      top10Requesters: top10.map((r) => ({ name: r.requester_name, count: Number(r.count) })),
      slaResolutionRate: slaRate,
      avgResolutionHours: avgRes[0]?.avg_hours ? Number(avgRes[0].avg_hours) : null,
      prev: hasFilter
        ? {
            total: Number(prevTotal[0]?.count ?? 0),
            slaResolutionRate: prevSlaRate,
            avgResolutionHours: prevAvgRes[0]?.avg_hours ? Number(prevAvgRes[0].avg_hours) : null,
          }
        : null,
    };
  }

  async getDashboardData(filters: QueryTicketsDto) {
    const [stats, recent] = await Promise.all([
      this.getStats(),
      this.findAll({ ...filters, limit: 10 }, true),
    ]);
    return { stats, recent: recent.data };
  }

  // -----------------------------------------------------------------------
  // Catalogs
  // -----------------------------------------------------------------------

  findCategories() {
    return this.categoriesRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  findSubcategories(slug: string) {
    return this.subcategoriesRepo.find({
      where: { categorySlug: slug, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  findAssignees() {
    return this.assigneesRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async getOrFail(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} no encontrado`);
    return ticket;
  }

  private async addHistory(
    ticketId: string,
    user: User,
    action: string,
    oldValue: string | null,
    newValue: string | null,
    notes?: string,
  ) {
    await this.historyRepo.save(
      this.historyRepo.create({
        ticketId,
        userId: user.id,
        userName: user.name,
        action,
        oldValue,
        newValue,
        notes: notes ?? null,
      }),
    );
  }
}
