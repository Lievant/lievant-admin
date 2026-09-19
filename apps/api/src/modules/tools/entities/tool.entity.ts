import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo administrativo de herramientas y licencias (schema `tools`).
 *
 * No confundir con `licenses.tool_catalog` (clase ToolCatalog): aquella es el
 * diccionario visual de la matriz de licenciamientos por colaborador.
 */
@Entity({ name: 'tools', schema: 'tools' })
export class Tool {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tool_code', type: 'varchar', length: 10, unique: true })
  toolCode!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ type: 'varchar', length: 200 })
  provider!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url!: string | null;

  // Los DECIMAL llegan como string desde pg; el transformer los deja en number
  // para que el frontend no tenga que parsear cada costo.
  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? 0 : Number(v)) },
  })
  unitCost!: number;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency!: string;

  @Column({ name: 'billing_period', type: 'varchar', length: 20 })
  billingPeriod!: string;

  @Column({ name: 'billing_day', type: 'int', nullable: true })
  billingDay!: number | null;

  @Column({ name: 'cost_center', type: 'varchar', length: 20, default: 'TI' })
  costCenter!: string;

  @Column({ name: 'commercial_contact', type: 'varchar', length: 200, nullable: true })
  commercialContact!: string | null;

  @Column({ name: 'next_renewal_date', type: 'date', nullable: true })
  nextRenewalDate!: string | null;

  @Column({ name: 'contract_status', type: 'varchar', length: 30, default: 'activo' })
  contractStatus!: string;

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval!: boolean;

  @Column({
    name: 'total_cost_calculated',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? 0 : Number(v)) },
  })
  totalCostCalculated!: number;

  @Column({ name: 'active_assignments_count', type: 'int', default: 0 })
  activeAssignmentsCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
