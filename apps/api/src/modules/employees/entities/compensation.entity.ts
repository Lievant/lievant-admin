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

@Entity({ name: 'compensation', schema: 'employees' })
export class Compensation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid', unique: true })
  employeeId!: string;

  @OneToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ name: 'daily_gross_salary', type: 'decimal', precision: 12, scale: 2, nullable: true })
  dailyGrossSalary!: string | null;

  @Column({ name: 'monthly_gross_salary', type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyGrossSalary!: string | null;

  @Column({ name: 'service_payment', type: 'decimal', precision: 12, scale: 2, nullable: true })
  servicePayment!: string | null;

  @Column({ name: 'last_salary_change', type: 'date', nullable: true })
  lastSalaryChange!: string | null;

  @Column({ name: 'remote_work_allowance', type: 'decimal', precision: 12, scale: 2, nullable: true })
  remoteWorkAllowance!: string | null;

  @Column({ name: 'grocery_vouchers', type: 'decimal', precision: 12, scale: 2, nullable: true })
  groceryVouchers!: string | null;

  @Column({ name: 'gas_vouchers', type: 'decimal', precision: 12, scale: 2, nullable: true })
  gasVouchers!: string | null;

  @Column({ name: 'health_insurance', type: 'varchar', length: 50, nullable: true })
  healthInsurance!: string | null;

  @Column({ name: 'phone_allowance', type: 'decimal', precision: 12, scale: 2, nullable: true })
  phoneAllowance!: string | null;

  @Column({ name: 'punctuality_bonus', type: 'decimal', precision: 12, scale: 2, nullable: true })
  punctualityBonus!: string | null;

  @Column({ name: 'other_benefits', type: 'text', nullable: true })
  otherBenefits!: string | null;

  @Column({ name: 'total_gross', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalGross!: string | null;

  @Column({ name: 'net_estimate', type: 'decimal', precision: 12, scale: 2, nullable: true })
  netEstimate!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
