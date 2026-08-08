import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CardExpenseReport } from './card-expense-report.entity';

@Entity({ name: 'card_expense_lines', schema: 'expenses' })
export class CardExpenseLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'report_id', type: 'uuid' })
  reportId!: string;

  @ManyToOne(() => CardExpenseReport, (report) => report.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report!: CardExpenseReport;

  @Column({ name: 'line_date', type: 'date' })
  lineDate!: string;

  /** Texto libre: puede no ser alguien de plantilla. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  collaborator!: string | null;

  @Column({ type: 'text', nullable: true })
  motive!: string | null;

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

  /** Generada en Postgres; TypeORM nunca debe escribirla. */
  @Column({ type: 'decimal', precision: 14, scale: 2, insert: false, update: false })
  total!: string;

  @Column({ name: 'has_invoice', type: 'boolean', default: false })
  hasInvoice!: boolean;

  @Column({ name: 'invoice_s3_key', type: 'varchar', length: 500, nullable: true })
  invoiceS3Key!: string | null;

  @Column({ name: 'invoice_original_name', type: 'varchar', length: 300, nullable: true })
  invoiceOriginalName!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Prefirmada al vuelo en el detalle; no se persiste porque caduca. */
  invoiceUrl?: string | null;
}
