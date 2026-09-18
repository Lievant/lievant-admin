import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';
import { Tool } from './tool.entity';

/**
 * Asignación de una herramienta del catálogo a un colaborador.
 *
 * Se llama ToolAssignmentRecord y no ToolAssignment porque ese nombre ya lo usa
 * `licenses.tool_assignments`, que es otra cosa: la matriz de acceso sí/no por
 * colaborador. Dos clases con el mismo nombre en el mismo DataSource hacen que
 * TypeORM resuelva la relación equivocada sin avisar.
 */
@Entity({ name: 'tool_assignments', schema: 'tools' })
export class ToolAssignmentRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tool_id', type: 'uuid' })
  toolId!: string;

  @ManyToOne(() => Tool, { eager: false })
  @JoinColumn({ name: 'tool_id' })
  tool!: Tool;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeRecord, { eager: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ type: 'varchar', length: 30, default: 'activa' })
  status!: string;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({
    name: 'unit_cost_override',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  unitCostOverride!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
