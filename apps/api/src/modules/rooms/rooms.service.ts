import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Booking, BookingStatus } from './entities/booking.entity';
import { AdminScope, OfficeAdmin } from './entities/office-admin.entity';
import { Office } from './entities/office.entity';
import { Room } from './entities/room.entity';

export interface RoomWithAvailability extends Room {
  is_available: boolean;
  occupied_by?: { userName: string; title: string };
}

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
    @InjectRepository(Office) private readonly officesRepository: Repository<Office>,
    @InjectRepository(Booking) private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(OfficeAdmin) private readonly officeAdminsRepository: Repository<OfficeAdmin>,
  ) {}

  async findWithAvailability(dto: QueryAvailabilityDto): Promise<RoomWithAvailability[]> {
    await this.getOfficeOrFail(dto.office_id);

    const qb = this.roomsRepository
      .createQueryBuilder('room')
      .where('room.officeId = :officeId', { officeId: dto.office_id })
      .andWhere('room.isActive = true')
      .orderBy('room.name', 'ASC');

    if (dto.room_type) {
      qb.andWhere('room.type = :type', { type: dto.room_type });
    }

    const rooms = await qb.getMany();

    if (rooms.length === 0) {
      return [];
    }

    const startTime = new Date(`${dto.date}T${dto.start_time}:00Z`);
    const endTime = new Date(startTime.getTime() + dto.duration_hours * 60 * 60 * 1000);
    const endTimeOfDay = `${String(endTime.getUTCHours()).padStart(2, '0')}:${String(endTime.getUTCMinutes()).padStart(2, '0')}`;

    // Una sola query para el solapamiento de TODAS las salas de la oficina, en
    // lugar de una por sala. Antes esto era un N+1 dentro de un Promise.all, que
    // además abría N conexiones del pool a la vez por cada búsqueda.
    const roomIds = rooms.map((room) => room.id);
    const overlapping = await this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.user', 'user')
      .where('booking.roomId IN (:...roomIds)', { roomIds })
      .andWhere('booking.status != :cancelled', { cancelled: BookingStatus.CANCELADA })
      .andWhere('booking.startTime < :endTime AND booking.endTime > :startTime', { startTime, endTime })
      .orderBy('booking.startTime', 'ASC')
      .getMany();

    // Basta la primera reserva que solape por sala: es la que se muestra como
    // "ocupada por". El orderBy deja la más temprana al frente.
    const occupiedByRoom = new Map<string, Booking>();
    for (const booking of overlapping) {
      if (!occupiedByRoom.has(booking.roomId)) {
        occupiedByRoom.set(booking.roomId, booking);
      }
    }

    return rooms.map((room) => {
      const withinHours = dto.start_time >= room.openTime.slice(0, 5) && endTimeOfDay <= room.closeTime.slice(0, 5);

      if (!withinHours) {
        return { ...room, is_available: false };
      }

      const booking = occupiedByRoom.get(room.id);
      if (booking) {
        return {
          ...room,
          is_available: false,
          occupied_by: { userName: booking.user.name, title: booking.title },
        };
      }

      return { ...room, is_available: true };
    });
  }

  async findOne(id: string): Promise<Room> {
    return this.getRoomOrFail(id);
  }

  async findAllByOffice(officeId: string, user: User): Promise<Room[]> {
    await this.assertOfficeAdmin(user, officeId);
    await this.getOfficeOrFail(officeId);

    return this.roomsRepository.find({ where: { officeId }, order: { name: 'ASC' } });
  }

  /**
   * Salas activas de una oficina, sin exigir permisos de administrador.
   * Alimenta la vista de calendario, que es de solo lectura y debe ser
   * accesible a cualquier usuario autenticado. A diferencia de
   * findAllByOffice (pantalla de admin), omite las salas inactivas y no
   * expone nada que el usuario no pueda ver ya al buscar disponibilidad.
   */
  async findActiveByOffice(officeId: string): Promise<Room[]> {
    await this.getOfficeOrFail(officeId);

    return this.roomsRepository.find({
      where: { officeId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateRoomDto, user: User): Promise<Room> {
    await this.assertOfficeAdmin(user, dto.office_id);
    await this.getOfficeOrFail(dto.office_id);

    const room = this.roomsRepository.create({
      officeId: dto.office_id,
      name: dto.name,
      type: dto.type,
      capacity: dto.capacity,
      floor: dto.floor ?? null,
      amenities: dto.amenities ?? [],
      openTime: dto.open_time ?? '08:00',
      closeTime: dto.close_time ?? '20:00',
      maxBookingHours: dto.max_booking_hours ?? 4,
      requiresApprovalOverHours: dto.requires_approval_over_hours ?? 4,
      notes: dto.notes ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return this.roomsRepository.save(room);
  }

  async update(id: string, dto: UpdateRoomDto, user: User): Promise<Room> {
    const room = await this.getRoomOrFail(id);
    await this.assertOfficeAdmin(user, room.officeId);

    if (dto.name !== undefined) room.name = dto.name;
    if (dto.type !== undefined) room.type = dto.type;
    if (dto.capacity !== undefined) room.capacity = dto.capacity;
    if (dto.floor !== undefined) room.floor = dto.floor ?? null;
    if (dto.amenities !== undefined) room.amenities = dto.amenities;
    if (dto.open_time !== undefined) room.openTime = dto.open_time;
    if (dto.close_time !== undefined) room.closeTime = dto.close_time;
    if (dto.max_booking_hours !== undefined) room.maxBookingHours = dto.max_booking_hours;
    if (dto.requires_approval_over_hours !== undefined) room.requiresApprovalOverHours = dto.requires_approval_over_hours;
    if (dto.notes !== undefined) room.notes = dto.notes ?? null;
    room.updatedBy = user.id;

    return this.roomsRepository.save(room);
  }

  async toggleActive(id: string, user: User): Promise<Room> {
    const room = await this.getRoomOrFail(id);
    await this.assertOfficeAdmin(user, room.officeId);

    room.isActive = !room.isActive;
    room.updatedBy = user.id;

    return this.roomsRepository.save(room);
  }

  private async assertOfficeAdmin(user: User, officeId: string): Promise<void> {
    if (user.roles.some((role) => role.name === 'SUPER_ADMIN')) {
      return;
    }

    const admins = await this.officeAdminsRepository.find({ where: { userId: user.id } });
    const isAdmin = admins.some(
      (admin) => admin.scope === AdminScope.GLOBAL || (admin.scope === AdminScope.OFFICE && admin.officeId === officeId),
    );

    if (!isAdmin) {
      throw new ForbiddenException('No tienes permisos de administrador para esta oficina');
    }
  }

  private async getRoomOrFail(id: string): Promise<Room> {
    const room = await this.roomsRepository.findOne({ where: { id }, relations: { office: true } });
    if (!room) {
      throw new NotFoundException(`Sala ${id} no encontrada`);
    }
    return room;
  }

  private async getOfficeOrFail(id: string): Promise<Office> {
    const office = await this.officesRepository.findOne({ where: { id } });
    if (!office) {
      throw new NotFoundException(`Oficina ${id} no encontrada`);
    }
    return office;
  }
}
