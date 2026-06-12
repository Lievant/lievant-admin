import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from './employee-record.entity';

@Entity({ name: 'vacations', schema: 'employees' })
export class Vacation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ type: 'smallint' })
  year!: number;

  @Column({ name: 'opening_balance', type: 'decimal', precision: 5, scale: 1, nullable: true })
  openingBalance!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  taken!: string;

  @Column({ name: 'closing_balance', type: 'decimal', precision: 5, scale: 1, nullable: true })
  closingBalance!: string | null;

  @Column({ name: 'support_activity_days', type: 'decimal', precision: 5, scale: 1, default: 0 })
  supportActivityDays!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
