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
import { Payment } from './payment.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { Vendor } from './vendor.entity';

export enum InvoiceStatus {
  PENDIENTE = 'pendiente',
  PAGADA = 'pagada',
}

@Entity({ schema: 'vendors', name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.invoices)
  @JoinColumn({ name: 'vendor_id' })
  vendor!: Vendor;

  @Column({ name: 'po_id', type: 'uuid', nullable: true })
  poId!: string | null;

  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.invoices, { nullable: true })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder!: PurchaseOrder | null;

  @Column({ name: 'invoice_number', type: 'varchar', length: 100 })
  invoiceNumber!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  tax!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'varchar', length: 20, default: InvoiceStatus.PENDIENTE })
  status!: InvoiceStatus;

  @Column({ name: 'pdf_s3_key', type: 'varchar', length: 500, nullable: true })
  pdfS3Key!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'updated_by', type: 'uuid' })
  updatedBy!: string;

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments!: Payment[];
}
