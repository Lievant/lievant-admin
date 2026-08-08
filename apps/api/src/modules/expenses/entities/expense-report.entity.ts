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
import { ExpenseLine } from './expense-line.entity';

export type ExpenseReportStatus =
  | 'draft'
  | 'submitted'
  | 'authorized'
  | 'rejected'
  | 'processed';

@Entity({ name: 'expense_reports', schema: 'expenses' })
export class ExpenseReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Identificación del documento en el SGSI; se guarda por reporte para que uno
  // emitido con la versión 00 no cambie de versión al actualizarse el formato.
  @Column({ name: 'document_code', type: 'varchar', length: 20, default: 'FIN-RE-07' })
  documentCode!: string;

  @Column({ name: 'document_version', type: 'varchar', length: 10, default: '00' })
  documentVersion!: string;

  @Column({ name: 'document_classification', type: 'varchar', length: 5, default: 'C2' })
  documentClassification!: string;

  /** FIN-RE-YYYY-NNN. Nulo mientras es borrador sin numerar. */
  @Column({ name: 'report_number', type: 'varchar', length: 20, nullable: true })
  reportNumber!: string | null;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requester_id' })
  requester!: User;

  @Column({ name: 'requester_employee_id', type: 'uuid', nullable: true })
  requesterEmployeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'requester_employee_id' })
  requesterEmployee!: EmployeeRecord | null;

  @Column({ name: 'authorizer_id', type: 'uuid', nullable: true })
  authorizerId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'authorizer_id' })
  authorizer!: User | null;

  @Column({ name: 'authorizer_employee_id', type: 'uuid', nullable: true })
  authorizerEmployeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'authorizer_employee_id' })
  authorizerEmployee!: EmployeeRecord | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department!: string | null;

  @Column({ type: 'text' })
  motive!: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart!: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd!: string;

  @Column({ name: 'total_subtotal', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalSubtotal!: string;

  @Column({ name: 'total_tip', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalTip!: string;

  @Column({ name: 'total_extras', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalExtras!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: ExpenseReportStatus;

  @Column({ name: 'authorized_at', type: 'timestamptz', nullable: true })
  authorizedAt!: Date | null;

  @Column({ name: 'authorization_note', type: 'text', nullable: true })
  authorizationNote!: string | null;

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

  @OneToMany(() => ExpenseLine, (line) => line.report, { cascade: false })
  lines!: ExpenseLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
