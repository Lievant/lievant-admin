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
import { User } from '../../auth/entities/user.entity';
import { ClientSegment } from '../constants/client-segment.constant';
import { ClientStatus } from '../constants/client-status.constant';
import { Company } from './company.entity';
import { Group } from './group.entity';

@Entity({ name: 'client_records', schema: 'clients' })
export class ClientRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_id', type: 'varchar', length: 20, unique: true })
  displayId!: string;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group!: Group | null;

  @Column({ name: 'primary_company_id', type: 'uuid' })
  primaryCompanyId!: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'primary_company_id' })
  primaryCompany!: Company;

  @Column({ type: 'varchar', length: 20, default: ClientStatus.ACTIVE })
  status!: ClientStatus;

  @Column({ name: 'account_manager_id', type: 'uuid', nullable: true })
  accountManagerId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'account_manager_id' })
  accountManager!: User | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'crm_id', type: 'varchar', length: 100, nullable: true })
  crmId!: string | null;

  @Column({ name: 'cor_id', type: 'varchar', length: 100, nullable: true })
  corId!: string | null;

  @Column({ name: 'contpaq_id', type: 'varchar', length: 100, nullable: true })
  contpaqId!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  segment!: ClientSegment | null;

  @Column({ name: 'nps_score', type: 'smallint', nullable: true })
  npsScore!: number | null;

  @Column({ name: 'last_contact_date', type: 'date', nullable: true })
  lastContactDate!: string | null;

  @Column({ name: 'dynamics_id', type: 'varchar', length: 100, nullable: true })
  dynamicsId!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  linkedin!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'México' })
  country!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
