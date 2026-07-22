import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from './employee-record.entity';

@Entity({ name: 'termination_data', schema: 'employees' })
export class TerminationData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid', unique: true })
  employeeId!: string;

  @OneToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ name: 'termination_date', type: 'date', nullable: true })
  terminationDate!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'severance_paid', type: 'boolean', default: false })
  severancePaid!: boolean;

  @Column({ name: 'severance_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  severanceAmount!: string | null;

  @Column({ name: 'references', type: 'text', nullable: true })
  references!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
