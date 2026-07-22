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
import { City } from './city.entity';
import { OfficeAdmin } from './office-admin.entity';
import { Room } from './room.entity';

@Entity({ schema: 'rooms', name: 'offices' })
export class Office {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'city_id', type: 'uuid' })
  cityId!: string;

  @ManyToOne(() => City, (city) => city.offices)
  @JoinColumn({ name: 'city_id' })
  city!: City;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Room, (room) => room.office)
  rooms!: Room[];

  @OneToMany(() => OfficeAdmin, (admin) => admin.office)
  admins!: OfficeAdmin[];
}
