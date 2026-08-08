import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExpenseReport } from './expense-report.entity';

@Entity({ name: 'expense_lines', schema: 'expenses' })
export class ExpenseLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId!: string;

  @ManyToOne(() => ExpenseReport, (report) => report.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report!: ExpenseReport;

  @Column({ name: 'line_date', type: 'date' })
  lineDate!: string;

  @Column({ type: 'varchar', length: 300 })
  vendor!: string;

  @Column({ name: 'concept_id', type: 'uuid', nullable: true })
  conceptId!: string | null;

  /** Copia del nombre al capturar: el catálogo puede renombrarse después. */
  @Column({ name: 'concept_name', type: 'varchar', length: 100, nullable: true })
  conceptName!: string | null;

  @Column({ name: 'expense_type_id', type: 'uuid', nullable: true })
  expenseTypeId!: string | null;

  @Column({ name: 'expense_type_name', type: 'varchar', length: 100, nullable: true })
  expenseTypeName!: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  tip!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  extras!: string;

  /**
   * Columna generada en Postgres (subtotal + tip + extras). Se marca de solo
   * lectura para que TypeORM nunca la incluya en INSERT/UPDATE: la base rechaza
   * escribir una GENERATED ALWAYS.
   */
  @Column({ type: 'decimal', precision: 14, scale: 2, insert: false, update: false, select: true })
  total!: string;

  @Column({ name: 'has_invoice', type: 'boolean', default: false })
  hasInvoice!: boolean;

  @Column({ name: 'invoice_s3_key', type: 'varchar', length: 500, nullable: true })
  invoiceS3Key!: string | null;

  @Column({ name: 'invoice_original_name', type: 'varchar', length: 300, nullable: true })
  invoiceOriginalName!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
