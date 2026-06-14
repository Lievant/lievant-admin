import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { VendorDocument } from './vendor-document.entity';
import { VendorProduct } from './vendor-product.entity';

export enum VendorStatus {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

@Entity({ schema: 'vendors', name: 'vendors' })
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'trade_name', type: 'varchar', length: 255, nullable: true })
  tradeName!: string | null;

  @Column({ type: 'varchar', length: 13, unique: true })
  rfc!: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'varchar', length: 20, default: VendorStatus.ACTIVO })
  status!: VendorStatus;

  @Column({ name: 'payment_terms_days', type: 'int', nullable: true, default: 30 })
  paymentTermsDays!: number | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  clabe!: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName!: string | null;

  @Column({ name: 'bank_account', type: 'varchar', length: 512, nullable: true })
  bankAccount!: string | null;

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

  @OneToMany(() => VendorProduct, (product) => product.vendor)
  products!: VendorProduct[];

  @OneToMany(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.vendor)
  purchaseOrders!: PurchaseOrder[];

  @OneToMany(() => Invoice, (invoice) => invoice.vendor)
  invoices!: Invoice[];

  @OneToMany(() => VendorDocument, (document) => document.vendor)
  documents!: VendorDocument[];
}
