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
import { EmployeeStatus } from '../constants/employee-status.constant';
import { Modality } from '../constants/modality.constant';

@Entity({ name: 'employee_records', schema: 'employees' })
export class EmployeeRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_id', type: 'varchar', length: 20, unique: true })
  displayId!: string;

  @Column({ name: 'cod_nom', type: 'varchar', length: 10, nullable: true })
  codNom!: string | null;

  @Column({ name: 'company_code', type: 'varchar', length: 50 })
  companyCode!: string;

  @Column({ name: 'company_name', type: 'varchar', length: 100 })
  companyName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  division!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  project!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  level!: string | null;

  @Column({ type: 'varchar', length: 200 })
  position!: string;

  @Column({ name: 'email_signature', type: 'varchar', length: 200, nullable: true })
  emailSignature!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  modality!: Modality | null;

  @Column({ name: 'contract_schema', type: 'varchar', length: 50, nullable: true })
  contractSchema!: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 300 })
  fullName!: string;

  @Column({ name: 'direct_report_to', type: 'varchar', length: 300, nullable: true })
  directReportTo!: string | null;

  @Column({ name: 'corporate_email', type: 'varchar', length: 200, nullable: true, unique: true })
  corporateEmail!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'Mexicana' })
  nationality!: string | null;

  @Column({ name: 'seniority_date', type: 'date', nullable: true })
  seniorityDate!: string | null;

  @Column({ name: 'contract_type', type: 'varchar', length: 50, nullable: true })
  contractType!: string | null;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  schedule!: string | null;

  @Column({ name: 'lunch_time', type: 'varchar', length: 50, nullable: true })
  lunchTime!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  studies!: string | null;

  @Column({ type: 'varchar', length: 20, default: EmployeeStatus.ACTIVE })
  status!: EmployeeStatus;

  @Column({ name: 'auth_user_id', type: 'uuid', nullable: true })
  authUserId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'auth_user_id' })
  authUser!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
