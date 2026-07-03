import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'project_financials', schema: 'projects' })
export class ProjectFinancials {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid', unique: true })
  projectId!: string;

  @Column({ name: 'billing_type', type: 'varchar', length: 20, default: 'monthly_fee' })
  billingType!: string;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency!: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 14, scale: 2, nullable: true })
  totalValue!: string | null;

  @Column({ name: 'monthly_fee', type: 'decimal', precision: 14, scale: 2, nullable: true })
  monthlyFee!: string | null;

  @Column({ name: 'overhead_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  overheadPercentage!: string;

  @Column({ name: 'has_commission', type: 'boolean', default: false })
  hasCommission!: boolean;

  @Column({ name: 'commission_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionPercentage!: string | null;

  @Column({ name: 'commission_employee_id', type: 'uuid', nullable: true })
  commissionEmployeeId!: string | null;

  @Column({ name: 'billing_day', type: 'integer', default: 1 })
  billingDay!: number;

  @Column({ name: 'billing_notes', type: 'text', nullable: true })
  billingNotes!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
