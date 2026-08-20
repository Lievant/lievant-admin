import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GraphAttendee, GraphTokenService } from '../auth/graph-token.service';
import { User } from '../auth/entities/user.entity';
import { userHasPermission } from '../auth/permissions.util';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking, BookingStatus } from './entities/booking.entity';
import { AdminScope, OfficeAdmin } from './entities/office-admin.entity';
import { Room } from './entities/room.entity';

const WEEKDAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export interface AdminBookingsQuery {
  office_id?: string | undefined;
  room_id?: string | undefined;
  status?: BookingStatus | undefined;
  date_from?: string | undefined;
  date_to?: string | undefined;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking) private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
    @InjectRepository(OfficeAdmin) private readonly officeAdminsRepository: Repository<OfficeAdmin>,
    private readonly graphTokenService: GraphTokenService,
  ) {}

  async create(dto: CreateBookingDto, currentUser: User): Promise<Booking[]> {
    const room = await this.roomsRepository.findOne({
      where: { id: dto.room_id },
      relations: { office: { city: true } },
    });

    if (!room || !room.isActive) {
      throw new NotFoundException(`Sala ${dto.room_id} no encontrada o inactiva`);
    }

    const startTime = new Date(dto.start_time);
    const endTime = new Date(dto.end_time);

    if (endTime <= startTime) {
      throw new BadRequestException('end_time debe ser posterior a start_time');
    }

    this.assertWithinOfficeHours(room, startTime, endTime);

    const durationHours = (endTime.getTime() - startTime.getTime()) / (60 * 60 * 1000);
    const status =
      durationHours > room.requiresApprovalOverHours ? BookingStatus.PENDIENTE_APROBACION : BookingStatus.CONFIRMADA;

    let occurrences: Array<{ start: Date; end: Date }> = [{ start: startTime, end: endTime }];
    let recurrenceGroupId: string | null = null;

    if (dto.is_recurring) {
      if (!dto.recurrence_rule || !dto.recurrence_end_date) {
        throw new BadRequestException(
          'recurrence_rule y recurrence_end_date son obligatorios para reservas recurrentes',
        );
      }

      const recurrenceEndDate = new Date(`${dto.recurrence_end_date}T23:59:59Z`);
      const maxEndDate = new Date(startTime);
      maxEndDate.setUTCMonth(maxEndDate.getUTCMonth() + 3);

      if (recurrenceEndDate > maxEndDate) {
        throw new BadRequestException('La fecha de fin de recurrencia no puede ser mayor a 3 meses desde el inicio');
      }

      const durationMs = endTime.getTime() - startTime.getTime();
      occurrences = this.generateRecurrenceDates(startTime, recurrenceEndDate, dto.recurrence_rule).map((occStart) => ({
        start: occStart,
        end: new Date(occStart.getTime() + durationMs),
      }));

      recurrenceGroupId = randomUUID();
    }

    for (const occurrence of occurrences) {
      if (await this.hasOverlap(room.id, occurrence.start, occurrence.end)) {
        throw new BadRequestException(
          `La sala ya está reservada el ${occurrence.start.toISOString()} en el horario solicitado`,
        );
      }
    }

    const bookings: Booking[] = [];
    for (const occurrence of occurrences) {
      const booking = await this.bookingsRepository.save(
        this.bookingsRepository.create({
          roomId: room.id,
          userId: currentUser.id,
          title: dto.title,
          startTime: occurrence.start,
          endTime: occurrence.end,
          status,
          isRecurring: !!dto.is_recurring,
          recurrenceRule: dto.is_recurring ? dto.recurrence_rule ?? null : null,
          recurrenceEndDate: dto.is_recurring ? dto.recurrence_end_date ?? null : null,
          recurrenceGroupId,
          notes: dto.notes ?? null,
          attendees: dto.attendees ?? [],
        }),
      );

      if (status === BookingStatus.CONFIRMADA) {
        await this.syncCalendarEvent(booking, room, currentUser);
      }

      bookings.push(booking);
    }

    return bookings;
  }

  async cancel(id: string, currentUser: User, dto: CancelBookingDto): Promise<Booking[]> {
    const booking = await this.bookingsRepository.findOne({ where: { id }, relations: { room: true, user: true } });
    if (!booking) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }

    const isOwner = booking.userId === currentUser.id;
    const isAdmin = await this.isOfficeAdmin(currentUser, booking.room.officeId);
    const canManageAll = this.canManageAllBookings(currentUser);

    if (!isOwner && !isAdmin && !canManageAll) {
      throw new ForbiddenException('Solo puedes cancelar tus propias reservas');
    }

    let bookingsToCancel = [booking];

    if (dto.cancel_series && booking.recurrenceGroupId) {
      bookingsToCancel = await this.bookingsRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.user', 'user')
        .where('booking.recurrenceGroupId = :groupId', { groupId: booking.recurrenceGroupId })
        .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELADA })
        .andWhere('booking.startTime >= :now', { now: new Date() })
        .getMany();
    }

    for (const current of bookingsToCancel) {
      current.status = BookingStatus.CANCELADA;
      current.cancelledAt = new Date();
      current.cancelledBy = currentUser.id;
      await this.bookingsRepository.save(current);

      if (current.msEventId) {
        try {
          const hasAttendees = (current.attendees ?? []).length > 0;
          if (hasAttendees) {
            // Notifica la cancelación por correo a los invitados.
            await this.graphTokenService.cancelCalendarEvent(current.user.email, current.msEventId);
          } else {
            await this.graphTokenService.deleteCalendarEvent(current.user.email, current.msEventId);
          }
        } catch (error) {
          this.logger.warn(`No se pudo cancelar el evento de calendario para la reserva ${current.id}: ${error}`);
        }
      }
    }

    return bookingsToCancel;
  }

  async update(id: string, currentUser: User, dto: UpdateBookingDto): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: { room: { office: { city: true } }, user: true },
    });
    if (!booking) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }

    const isOwner = booking.userId === currentUser.id;
    const isAdmin = await this.isOfficeAdmin(currentUser, booking.room.officeId);
    const canManageAll = this.canManageAllBookings(currentUser);
    if (!isOwner && !isAdmin && !canManageAll) {
      throw new ForbiddenException('Solo puedes modificar tus propias reservas');
    }

    if (booking.status === BookingStatus.CANCELADA) {
      throw new BadRequestException('No se puede modificar una reserva cancelada');
    }

    // Cambio de sala → la reserva se valida contra la sala destino, no la actual.
    const salaAnterior = booking.room;
    const nuevaSalaId =
      dto.room_id !== undefined && dto.room_id !== booking.roomId ? dto.room_id : null;
    const roomChanged = nuevaSalaId !== null;
    let targetRoom = booking.room;

    if (nuevaSalaId) {
      const nueva = await this.roomsRepository.findOne({
        where: { id: nuevaSalaId },
        relations: { office: { city: true } },
      });
      if (!nueva) {
        throw new NotFoundException(`Sala ${nuevaSalaId} no encontrada`);
      }
      if (!nueva.isActive) {
        throw new BadRequestException('La sala seleccionada está desactivada');
      }
      // Mover una reserva a otra oficina cambiaría su zona horaria y su horario
      // de servicio; el cambio de sala es dentro de la misma sede.
      if (nueva.officeId !== salaAnterior.officeId) {
        throw new BadRequestException('Solo puedes cambiar a una sala de la misma oficina');
      }
      targetRoom = nueva;
    }

    // El solapamiento se revalida también cuando solo cambia la sala: el horario
    // puede seguir igual y estar ocupado en la sala destino.
    const timeChanged = dto.start_time !== undefined || dto.end_time !== undefined;
    if (timeChanged || roomChanged) {
      const startTime = dto.start_time ? new Date(dto.start_time) : booking.startTime;
      const endTime = dto.end_time ? new Date(dto.end_time) : booking.endTime;
      if (endTime <= startTime) {
        throw new BadRequestException('end_time debe ser posterior a start_time');
      }
      this.assertWithinOfficeHours(targetRoom, startTime, endTime);
      if (await this.hasOverlap(targetRoom.id, startTime, endTime, booking.id)) {
        throw new BadRequestException('La sala ya está reservada en el horario solicitado');
      }
      booking.startTime = startTime;
      booking.endTime = endTime;
    }

    if (roomChanged) {
      booking.roomId = targetRoom.id;
      booking.room = targetRoom;
      // No hay tabla de auditoría para reservas; queda en el log del servicio.
      this.logger.log(
        `Reserva ${booking.id}: sala cambiada de "${salaAnterior.name}" (${salaAnterior.id}) ` +
          `a "${targetRoom.name}" (${targetRoom.id}) por ${currentUser.email}`,
      );
    }

    if (dto.title !== undefined) booking.title = dto.title;
    if (dto.notes !== undefined) booking.notes = dto.notes;
    if (dto.attendees !== undefined) booking.attendees = dto.attendees;

    const saved = await this.bookingsRepository.save(booking);

    // Sincronizar M365 — con la sala destino, para que el evento refleje el
    // cambio de ubicación y no la sala anterior.
    if (saved.status === BookingStatus.CONFIRMADA) {
      const timeZone = targetRoom.office?.city?.timezone ?? 'America/Mexico_City';
      if (saved.msEventId) {
        try {
          const { joinUrl } = await this.graphTokenService.updateCalendarEvent(
            booking.user.email,
            saved.msEventId,
            {
              subject: saved.title,
              start: { dateTime: this.toGraphDateTime(saved.startTime), timeZone },
              end: { dateTime: this.toGraphDateTime(saved.endTime), timeZone },
              location: { displayName: targetRoom.name },
              attendees: this.toGraphAttendees(saved.attendees),
              body: this.buildEventBody(targetRoom, saved.notes),
              isOnlineMeeting: true,
              onlineMeetingProvider: 'teamsForBusiness' as const,
            },
          );

          // Recupera el link de las reservas creadas antes de este fix.
          if (joinUrl && joinUrl !== saved.teamsMeetingUrl) {
            saved.teamsMeetingUrl = joinUrl;
            await this.bookingsRepository.save(saved);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Error actualizando evento M365 para la reserva ${saved.id}: ${message}`);
        }
      } else {
        // No tenía evento (p. ej. antes falló) → intentar crearlo ahora.
        await this.syncCalendarEvent(saved, targetRoom, booking.user);
      }
    }

    return saved;
  }

  async approve(id: string, currentUser: User): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: { id },
      relations: { room: { office: { city: true } }, user: true },
    });

    if (!booking) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }

    if (!(await this.isOfficeAdmin(currentUser, booking.room.officeId))) {
      throw new ForbiddenException('No tienes permisos para aprobar reservas de esta oficina');
    }

    if (booking.status !== BookingStatus.PENDIENTE_APROBACION) {
      throw new BadRequestException('Solo se pueden aprobar reservas pendientes de aprobación');
    }

    booking.status = BookingStatus.CONFIRMADA;
    const saved = await this.bookingsRepository.save(booking);

    await this.syncCalendarEvent(saved, booking.room, booking.user);

    return saved;
  }

  async reject(id: string, currentUser: User): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({ where: { id }, relations: { room: true } });

    if (!booking) {
      throw new NotFoundException(`Reserva ${id} no encontrada`);
    }

    if (!(await this.isOfficeAdmin(currentUser, booking.room.officeId))) {
      throw new ForbiddenException('No tienes permisos para rechazar reservas de esta oficina');
    }

    if (booking.status !== BookingStatus.PENDIENTE_APROBACION) {
      throw new BadRequestException('Solo se pueden rechazar reservas pendientes de aprobación');
    }

    booking.status = BookingStatus.CANCELADA;
    booking.cancelledAt = new Date();
    booking.cancelledBy = currentUser.id;

    return this.bookingsRepository.save(booking);
  }

  async findMy(userId: string, status?: BookingStatus, upcoming?: boolean): Promise<Booking[]> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.office', 'office')
      .leftJoinAndSelect('office.city', 'city')
      .where('booking.userId = :userId', { userId })
      .orderBy('booking.startTime', 'ASC');

    if (status) {
      qb.andWhere('booking.status = :status', { status });
    }

    if (upcoming) {
      // No se puede usar new Date() ni NOW(): start_time guarda la hora de
      // pared local en componentes UTC (ver assertWithinOfficeHours), así que
      // el epoch real va adelantado por el offset de la oficina y descartaría
      // reservas de hoy que todavía no empiezan.
      qb.andWhere('booking.startTime >= :now', { now: this.wallClockNow() });
    }

    return qb.getMany();
  }

  async findAdmin(currentUser: User, query: AdminBookingsQuery): Promise<Booking[]> {
    const isSuperAdmin = currentUser.roles.some((role) => role.name === 'SUPER_ADMIN');
    const canManageAll = this.canManageAllBookings(currentUser);
    const adminEntries = await this.officeAdminsRepository.find({ where: { userId: currentUser.id } });

    if (!isSuperAdmin && !canManageAll && adminEntries.length === 0) {
      throw new ForbiddenException('No tienes permisos de administrador de salas');
    }

    // salas.manage da alcance global: ve las reservas de todas las oficinas.
    const isGlobalAdmin =
      isSuperAdmin || canManageAll || adminEntries.some((entry) => entry.scope === AdminScope.GLOBAL);
    const officeIds = adminEntries
      .filter((entry) => entry.scope === AdminScope.OFFICE && entry.officeId)
      .map((entry) => entry.officeId as string);

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('room.office', 'office')
      .leftJoinAndSelect('office.city', 'city')
      .leftJoinAndSelect('booking.user', 'user')
      .orderBy('booking.startTime', 'DESC');

    if (query.office_id) {
      if (!isGlobalAdmin && !officeIds.includes(query.office_id)) {
        throw new ForbiddenException('No administras esta oficina');
      }
      qb.andWhere('room.officeId = :officeId', { officeId: query.office_id });
    } else if (!isGlobalAdmin) {
      qb.andWhere('room.officeId IN (:...officeIds)', { officeIds: officeIds.length ? officeIds : [null] });
    }

    if (query.room_id) {
      qb.andWhere('booking.roomId = :roomId', { roomId: query.room_id });
    }

    if (query.status) {
      qb.andWhere('booking.status = :status', { status: query.status });
    }

    if (query.date_from) {
      qb.andWhere('booking.startTime >= :dateFrom', { dateFrom: query.date_from });
    }

    if (query.date_to) {
      qb.andWhere('booking.startTime <= :dateTo', { dateTo: query.date_to });
    }

    return qb.getMany();
  }

  async findPendingApproval(currentUser: User): Promise<Booking[]> {
    return this.findAdmin(currentUser, { status: BookingStatus.PENDIENTE_APROBACION });
  }

  /** herramientas.salas.manage → puede editar/cancelar reservas de cualquiera. */
  canManageAllBookings(user: User): boolean {
    return userHasPermission(user, 'herramientas', 'salas', 'manage');
  }

  async isOfficeAdmin(user: User, officeId?: string): Promise<boolean> {
    if (user.roles.some((role) => role.name === 'SUPER_ADMIN')) {
      return true;
    }

    const admins = await this.officeAdminsRepository.find({ where: { userId: user.id } });
    return admins.some(
      (admin) => admin.scope === AdminScope.GLOBAL || (admin.scope === AdminScope.OFFICE && admin.officeId === officeId),
    );
  }

  /**
   * "Ahora" en la convención de almacenamiento del módulo: la hora de pared de
   * la zona indicada, expresada en componentes UTC. Sirve para comparar contra
   * start_time/end_time sin el desfase del offset.
   */
  private wallClockNow(timeZone = 'America/Mexico_City'): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());

    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    return new Date(
      Date.UTC(
        value('year'),
        value('month') - 1,
        value('day'),
        value('hour'),
        value('minute'),
        value('second'),
      ),
    );
  }

  private assertWithinOfficeHours(room: Room, startTime: Date, endTime: Date): void {
    const startTimeOfDay = `${String(startTime.getUTCHours()).padStart(2, '0')}:${String(startTime.getUTCMinutes()).padStart(2, '0')}`;
    const endTimeOfDay = `${String(endTime.getUTCHours()).padStart(2, '0')}:${String(endTime.getUTCMinutes()).padStart(2, '0')}`;

    if (startTimeOfDay < room.openTime.slice(0, 5) || endTimeOfDay > room.closeTime.slice(0, 5)) {
      throw new BadRequestException(
        `La reserva debe estar dentro del horario de la sala (${room.openTime.slice(0, 5)} - ${room.closeTime.slice(0, 5)})`,
      );
    }
  }

  private async hasOverlap(
    roomId: string,
    startTime: Date,
    endTime: Date,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .where('booking.roomId = :roomId', { roomId })
      .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELADA })
      .andWhere('booking.startTime < :endTime AND booking.endTime > :startTime', { startTime, endTime });

    if (excludeBookingId) {
      qb.andWhere('booking.id != :excludeBookingId', { excludeBookingId });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  private generateRecurrenceDates(startTime: Date, recurrenceEndDate: Date, rrule: string): Date[] {
    const freqMatch = rrule.match(/FREQ=([A-Z]+)/);
    if (!freqMatch || freqMatch[1] !== 'WEEKLY') {
      throw new BadRequestException('Solo se soporta recurrencia semanal (FREQ=WEEKLY)');
    }

    const byDayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
    const byDays = byDayMatch
      ? byDayMatch[1]!.split(',').map((day) => {
          const value = WEEKDAY_MAP[day];
          if (value === undefined) {
            throw new BadRequestException(`Día de recurrencia inválido: ${day}`);
          }
          return value;
        })
      : [startTime.getUTCDay()];

    const dates: Date[] = [];
    const weekStart = new Date(startTime);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());

    const cursor = new Date(weekStart);
    while (cursor <= recurrenceEndDate) {
      for (const day of byDays) {
        const occurrence = new Date(cursor);
        occurrence.setUTCDate(occurrence.getUTCDate() + day);
        occurrence.setUTCHours(startTime.getUTCHours(), startTime.getUTCMinutes(), startTime.getUTCSeconds(), 0);

        if (occurrence >= startTime && occurrence <= recurrenceEndDate) {
          dates.push(occurrence);
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    return dates.sort((a, b) => a.getTime() - b.getTime());
  }

  private toGraphAttendees(attendees: Booking['attendees']): GraphAttendee[] {
    return (attendees ?? []).map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: 'required' as const,
    }));
  }

  /**
   * Formatea la hora hacia Microsoft Graph. Por convención, startTime/endTime
   * almacenan la hora de pared local en componentes UTC (ver assertWithinOfficeHours),
   * así que enviamos un string naive "YYYY-MM-DDTHH:mm:ss" SIN la 'Z'. Junto con el
   * campo timeZone, Graph la interpreta como hora local y no la reconvierte desde UTC
   * (lo que causaba el desfase de varias horas en el evento del calendario).
   */
  private toGraphDateTime(date: Date): string {
    return date.toISOString().slice(0, 19);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildEventBody(room: Room, notes: string | null): { contentType: 'HTML'; content: string } {
    const notesHtml = notes ? `<p>${this.escapeHtml(notes)}</p>` : '';
    return {
      contentType: 'HTML',
      content: `<p>Reserva de sala: <strong>${this.escapeHtml(room.name)}</strong>.</p>${notesHtml}`,
    };
  }

  async findForCalendar(officeId: string, date: string): Promise<Booking[]> {
    if (!officeId || !date) {
      return [];
    }
    const start = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      return [];
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.room', 'room')
      .leftJoinAndSelect('booking.user', 'user')
      .where('room.officeId = :officeId', { officeId })
      .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELADA })
      .andWhere('booking.startTime >= :start AND booking.startTime < :end', { start, end })
      .orderBy('booking.startTime', 'ASC')
      .getMany();
  }

  private async syncCalendarEvent(booking: Booking, room: Room, user: User): Promise<void> {
    try {
      const timeZone = room.office?.city?.timezone ?? 'America/Mexico_City';
      // Siempre se pide reunión de Teams, también sin invitados: quien reserva
      // suele agregar gente después, y antes una reserva sin invitados nacía sin
      // link y ya no había forma de obtenerlo.
      const { id: eventId, joinUrl } = await this.graphTokenService.createCalendarEvent(user.email, {
        subject: booking.title,
        start: { dateTime: this.toGraphDateTime(booking.startTime), timeZone },
        end: { dateTime: this.toGraphDateTime(booking.endTime), timeZone },
        location: { displayName: room.name },
        attendees: this.toGraphAttendees(booking.attendees),
        body: this.buildEventBody(room, booking.notes),
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness' as const,
      });

      booking.msEventId = eventId;
      booking.teamsMeetingUrl = joinUrl;
      await this.bookingsRepository.save(booking);
    } catch (error) {
      // Logging explícito para diagnóstico (Ajuste 6): mensaje + stack.
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error creando evento M365 para la reserva ${booking.id}: ${message}`,
        stack,
      );
    }
  }
}
