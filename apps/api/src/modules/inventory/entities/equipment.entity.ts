import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';

@Entity({ name: 'equipment', schema: 'inventory' })
export class Equipment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_id', type: 'varchar', length: 20, unique: true })
  displayId!: string;

  @Column({ name: 'legacy_id', type: 'varchar', length: 50, nullable: true })
  legacyId!: string | null;

  @Column({ name: 'equipment_type', type: 'varchar', length: 50 })
  equipmentType!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  model!: string | null;

  @Column({ name: 'serial_number', type: 'varchar', length: 100, nullable: true })
  serialNumber!: string | null;

  @Column({ name: 'operating_system', type: 'varchar', length: 50, nullable: true })
  operatingSystem!: string | null;

  @Column({ name: 'ad_name', type: 'varchar', length: 100, nullable: true })
  adName!: string | null;

  @Column({ type: 'text', nullable: true })
  specifications!: string | null;

  @Column({ name: 'assigned_to_employee_id', type: 'uuid', nullable: true })
  assignedToEmployeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_to_employee_id' })
  assignedEmployee!: EmployeeRecord | null;

  @Column({ name: 'assignment_date', type: 'date', nullable: true })
  assignmentDate!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  responsiva!: string | null;

  @Column({ name: 'charger_included', type: 'boolean', default: false })
  chargerIncluded!: boolean;

  @Column({ type: 'varchar', length: 50, default: 'Disponible' })
  status!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  area!: string | null;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate!: string | null;

  @Column({ name: 'purchase_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  purchaseValue!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  // ── Garantía ──────────────────────────────────────────────────────────────
  // El proveedor es FK a vendors.vendors; aquí solo vive el id para no arrastrar
  // el padrón completo en cada consulta de inventario.
  @Column({ name: 'warranty_provider_id', type: 'uuid', nullable: true })
  warrantyProviderId!: string | null;

  @Column({ name: 'warranty_invoice_s3_key', type: 'varchar', length: 500, nullable: true })
  warrantyInvoiceS3Key!: string | null;

  @Column({ name: 'warranty_invoice_original_name', type: 'varchar', length: 255, nullable: true })
  warrantyInvoiceOriginalName!: string | null;

  @Column({ name: 'warranty_expiry_date', type: 'date', nullable: true })
  warrantyExpiryDate!: string | null;

  @Column({ name: 'warranty_purchase_order', type: 'varchar', length: 100, nullable: true })
  warrantyPurchaseOrder!: string | null;

  @Column({ name: 'warranty_notes', type: 'text', nullable: true })
  warrantyNotes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;
}
