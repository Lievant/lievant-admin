import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { VendorProduct } from './vendor-product.entity';

@Entity({ schema: 'vendors', name: 'po_line_items' })
export class POLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'po_id', type: 'uuid' })
  poId!: string;

  @ManyToOne(() => PurchaseOrder, (purchaseOrder) => purchaseOrder.lineItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'po_id' })
  purchaseOrder!: PurchaseOrder;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId!: string | null;

  @ManyToOne(() => VendorProduct, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product!: VendorProduct | null;

  @Column({ type: 'varchar', length: 500 })
  description!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
