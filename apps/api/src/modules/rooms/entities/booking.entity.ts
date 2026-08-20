import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Room } from './room.entity';

export enum BookingStatus {
  CONFIRMADA = 'confirmada',
  CANCELADA = 'cancelada',
  PENDIENTE_APROBACION = 'pendiente_aprobacion',
}

export interface BookingAttendee {
  email: string;
  name?: string;
}

@Entity({ schema: 'rooms', name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => Room, (room) => room.bookings)
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @Column({ type: 'varchar', length: 30, default: BookingStatus.CONFIRMADA })
  status!: BookingStatus;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring!: boolean;

  @Column({ name: 'recurrence_rule', type: 'text', nullable: true })
  recurrenceRule!: string | null;

  @Column({ name: 'recurrence_end_date', type: 'date', nullable: true })
  recurrenceEndDate!: string | null;

  @Column({ name: 'recurrence_group_id', type: 'uuid', nullable: true })
  recurrenceGroupId!: string | null;

  @Column({ name: 'ms_event_id', type: 'varchar', length: 500, nullable: true })
  msEventId!: string | null;

  /**
   * Link de la reunión de Teams que Graph genera al crear el evento. Null si el
   * evento se creó sin reunión en línea o si Graph no lo devolvió.
   */
  @Column({ name: 'teams_meeting_url', type: 'varchar', length: 500, nullable: true })
  teamsMeetingUrl!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  attendees!: BookingAttendee[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy!: string | null;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'cancelled_by' })
  cancelledByUser!: User | null;
}
