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
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';
import { VacationBalance } from './vacation-balance.entity';

export type VacationRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

@Entity({ name: 'vacation_requests', schema: 'hr' })
export class VacationRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_id', type: 'varchar', length: 20, unique: true })
  displayId!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ name: 'balance_id', type: 'uuid' })
  balanceId!: string;

  @ManyToOne(() => VacationBalance)
  @JoinColumn({ name: 'balance_id' })
  balance!: VacationBalance;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ name: 'working_days_taken', type: 'decimal', precision: 6, scale: 2 })
  workingDaysTaken!: string;

  @Column({ name: 'substitute_employee_id', type: 'uuid', nullable: true })
  substituteEmployeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'substitute_employee_id' })
  substitute!: EmployeeRecord | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: VacationRequestStatus;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** true cuando la levantó RRHH en nombre del colaborador, no el colaborador. */
  @Column({ name: 'created_by_admin', type: 'boolean', default: false })
  createdByAdmin!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
