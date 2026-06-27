import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
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

@Injectable()
export class HelpdeskService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketsRepo: Repository<Ticket>,
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

    return { data, nextCursor, total: data.length };
  }

  async findById(id: string) {
    const ticket = await this.ticketsRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} no encontrado`);
    const history = await this.historyRepo.find({
      where: { ticketId: id },
      order: { createdAt: 'ASC' },
    });
    return { ...ticket, history };
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

  async getStats() {
    const [byStatus, byPriority, slaData, avgRes] = await Promise.all([
      this.ticketsRepo.manager.query<Array<{ status: string; count: string }>>(
        `SELECT status, COUNT(*)::int AS count FROM helpdesk.tickets WHERE deleted_at IS NULL GROUP BY status`,
      ),
      this.ticketsRepo.manager.query<Array<{ priority: string; count: string }>>(
        `SELECT priority, COUNT(*)::int AS count FROM helpdesk.tickets WHERE deleted_at IS NULL AND priority IS NOT NULL GROUP BY priority`,
      ),
      this.ticketsRepo.manager.query<Array<{ total: string; resolution_met: string }>>(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE sla_resolution_met = true)::int AS resolution_met FROM helpdesk.tickets WHERE deleted_at IS NULL AND sla_resolution_met IS NOT NULL`,
      ),
      this.ticketsRepo.manager.query<Array<{ avg_hours: string }>>(
        `SELECT ROUND(AVG(resolution_hours)::numeric, 2) AS avg_hours FROM helpdesk.tickets WHERE deleted_at IS NULL AND resolution_hours IS NOT NULL`,
      ),
    ]);

    const total = byStatus.reduce((s, r) => s + Number(r.count), 0);
    const sla = slaData[0];
    const slaRate = sla && Number(sla.total) > 0
      ? Math.round((Number(sla.resolution_met) / Number(sla.total)) * 100)
      : null;

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, Number(r.count)])),
      slaResolutionRate: slaRate,
      avgResolutionHours: avgRes[0]?.avg_hours ? Number(avgRes[0].avg_hours) : null,
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
