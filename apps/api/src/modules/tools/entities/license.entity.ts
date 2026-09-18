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
import { Tool } from './tool.entity';

const money = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : Number(v)),
};

/**
 * Una licencia concreta: el folio LIC-### que aparece en la factura.
 *
 * Se llama License y vive en el módulo `tools` (no en `modules/licenses`, que es
 * la matriz de acceso por colaborador del Maestro de Licenciamientos).
 */
@Entity({ name: 'licenses', schema: 'tools' })
export class License {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'license_code', type: 'varchar', length: 15, unique: true })
  licenseCode!: string;

  @Column({ name: 'tool_id', type: 'uuid' })
  toolId!: string;

  @ManyToOne(() => Tool, { eager: false })
  @JoinColumn({ name: 'tool_id' })
  tool!: Tool;

  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { eager: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord | null;

  @Column({ name: 'employee_user_id', type: 'uuid', nullable: true })
  employeeUserId!: string | null;

  @Column({ name: 'license_type', type: 'varchar', length: 100, nullable: true })
  licenseType!: string | null;

  @Column({ name: 'business_unit', type: 'varchar', length: 100, nullable: true })
  businessUnit!: string | null;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: money,
  })
  unitCost!: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'activa' })
  status!: string;

  @Column({ name: 'assigned_at', type: 'date' })
  assignedAt!: string;

  @Column({ name: 'expires_at', type: 'date', nullable: true })
  expiresAt!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
