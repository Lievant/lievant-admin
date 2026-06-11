import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContactType } from '../constants/contact-type.constant';
import { ClientRecord } from './client-record.entity';

@Entity({ name: 'contacts', schema: 'clients' })
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_record_id', type: 'uuid' })
  clientRecordId!: string;

  @ManyToOne(() => ClientRecord)
  @JoinColumn({ name: 'client_record_id' })
  clientRecord!: ClientRecord;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  position!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area!: string | null;

  @Column({ name: 'contact_type', type: 'varchar', length: 50, nullable: true })
  contactType!: ContactType | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mobile!: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
