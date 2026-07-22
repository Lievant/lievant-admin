import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';
import { AdAccount } from './ad-account.entity';

export type BudgetSource = 'manual' | 'excel' | 'api';

@Entity({ name: 'budgets', schema: 'media_control' })
export class MediaBudget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ad_account_id', type: 'uuid' })
  adAccountId!: string;

  @ManyToOne(() => AdAccount)
  @JoinColumn({ name: 'ad_account_id' })
  adAccount!: AdAccount;

  @Column({ name: 'budget_month', type: 'date' })
  budgetMonth!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency!: string;

  @Column({ name: 'amount_mxn', type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountMxn!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent!: boolean;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByEmployee!: EmployeeRecord | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source!: BudgetSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;
}
