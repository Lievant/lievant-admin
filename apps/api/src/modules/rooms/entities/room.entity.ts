import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Office } from './office.entity';

export enum RoomType {
  SALA_REUNION = 'sala_reunion',
  PHONE_BOOTH = 'phone_booth',
}

@Entity({ schema: 'rooms', name: 'rooms' })
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'office_id', type: 'uuid' })
  officeId!: string;

  @ManyToOne(() => Office, (office) => office.rooms)
  @JoinColumn({ name: 'office_id' })
  office!: Office;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: RoomType.SALA_REUNION })
  type!: RoomType;

  @Column({ type: 'int', default: 1 })
  capacity!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  floor!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  amenities!: string[];

  @Column({ name: 'open_time', type: 'time', default: '08:00' })
  openTime!: string;

  @Column({ name: 'close_time', type: 'time', default: '20:00' })
  closeTime!: string;

  @Column({ name: 'max_booking_hours', type: 'int', default: 4 })
  maxBookingHours!: number;

  @Column({ name: 'requires_approval_over_hours', type: 'int', default: 4 })
  requiresApprovalOverHours!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'updated_by', type: 'uuid' })
  updatedBy!: string;

  @OneToMany(() => Booking, (booking) => booking.room)
  bookings!: Booking[];
}
