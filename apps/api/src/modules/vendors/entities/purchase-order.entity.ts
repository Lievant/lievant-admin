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
import { Invoice } from './invoice.entity';
import { POLineItem } from './po-line-item.entity';
import { Vendor } from './vendor.entity';

export enum POStatus {
  BORRADOR = 'borrador',
  APROBADA = 'aprobada',
  CERRADA = 'cerrada',
}

@Entity({ schema: 'vendors', name: 'purchase_orders' })
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'po_number', type: 'varchar', length: 20, unique: true })
  poNumber!: string;

  @Column({ name: 'vendor_id', type: 'uuid' })
  vendorId!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.purchaseOrders)
  @JoinColumn({ name: 'vendor_id' })
  vendor!: Vendor;

  @Column({ type: 'varchar', length: 20, default: POStatus.BORRADOR })
  status!: POStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subtotal!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  tax!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total!: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

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

  @OneToMany(() => POLineItem, (lineItem) => lineItem.purchaseOrder)
  lineItems!: POLineItem[];

  @OneToMany(() => Invoice, (invoice) => invoice.purchaseOrder)
  invoices!: Invoice[];
}
