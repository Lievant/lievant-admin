import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';

@Entity({ name: 'vacation_balances', schema: 'hr' })
export class VacationBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  @Column({ name: 'years_of_service', type: 'int' })
  yearsOfService!: number;

  @Column({ name: 'entitled_days', type: 'int' })
  entitledDays!: number;

  @Column({ name: 'used_days', type: 'decimal', precision: 6, scale: 2, default: 0 })
  usedDays!: string;

  @Column({ name: 'expired_days', type: 'decimal', precision: 6, scale: 2, default: 0 })
  expiredDays!: string;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
