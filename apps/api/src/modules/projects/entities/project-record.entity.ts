import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'project_records', schema: 'projects' })
export class ProjectRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_id', type: 'varchar', length: 20, unique: true })
  displayId!: string;

  @Column({ name: 'cor_project_id', type: 'varchar', length: 50, nullable: true })
  corProjectId!: string | null;

  @Column({ name: 'pm_code', type: 'varchar', length: 50, nullable: true })
  pmCode!: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'project_type', type: 'varchar', length: 20, default: 'recurring' })
  projectType!: string;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status!: string;

  @Column({ name: 'client_record_id', type: 'uuid', nullable: true })
  clientRecordId!: string | null;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId!: string | null;

  @Column({ name: 'primary_business_unit', type: 'varchar', length: 50, nullable: true })
  primaryBusinessUnit!: string | null;

  @Column({ name: 'project_manager_id', type: 'uuid', nullable: true })
  projectManagerId!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ name: 'cor_synced_at', type: 'timestamptz', nullable: true })
  corSyncedAt!: Date | null;

  @Column({ name: 'cor_sync_status', type: 'varchar', length: 20, default: 'pending' })
  corSyncStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;
}
