import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';
import { CardExpenseLine } from './card-expense-line.entity';
import { CreditCard } from './credit-card.entity';

/** Sin paso de autorización: el gasto ya ocurrió, solo se reporta y se procesa. */
export type CardExpenseReportStatus = 'draft' | 'submitted' | 'processed';

@Entity({ name: 'card_expense_reports', schema: 'expenses' })
export class CardExpenseReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_code', type: 'varchar', length: 20, default: 'FIN-RE-06' })
  documentCode!: string;

  @Column({ name: 'document_version', type: 'varchar', length: 10, default: '00' })
  documentVersion!: string;

  @Column({ name: 'document_classification', type: 'varchar', length: 5, default: 'C2' })
  documentClassification!: string;

  /** FIN-TC-YYYY-NNN. */
  @Column({ name: 'report_number', type: 'varchar', length: 20, nullable: true })
  reportNumber!: string | null;

  @Column({ name: 'credit_card_id', type: 'uuid' })
  creditCardId!: string;

  @ManyToOne(() => CreditCard)
  @JoinColumn({ name: 'credit_card_id' })
  creditCard!: CreditCard;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator!: User;

  @Column({ name: 'creator_employee_id', type: 'uuid', nullable: true })
  creatorEmployeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'creator_employee_id' })
  creatorEmployee!: EmployeeRecord | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department!: string | null;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  /** Reparto de cargos entre áreas y su porcentaje. */
  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @Column({ name: 'total_subtotal', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalSubtotal!: string;

  @Column({ name: 'total_tip', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalTip!: string;

  @Column({ name: 'total_extras', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalExtras!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: CardExpenseReportStatus;

  @Column({ name: 'processed_by', type: 'uuid', nullable: true })
  processedBy!: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate!: string | null;

  @Column({ name: 'payment_note', type: 'text', nullable: true })
  paymentNote!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @OneToMany(() => CardExpenseLine, (line) => line.report)
  lines!: CardExpenseLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
