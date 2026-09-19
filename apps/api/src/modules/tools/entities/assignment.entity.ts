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

/**
 * Asignación de una herramienta a un colaborador.
 *
 * Sustituye a ToolAssignmentRecord (tools.tool_assignments) y a License
 * (tools.licenses): las dos modelaban este mismo vínculo con reglas distintas.
 */
@Entity({ name: 'assignments', schema: 'tools' })
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_code', type: 'varchar', length: 15, unique: true })
  assignmentCode!: string;

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

  @Column({ name: 'assigned_by_id', type: 'uuid', nullable: true })
  assignedById!: string | null;

  /** Snapshot: el histórico no cambia si el asignador sale del catálogo. */
  @Column({ name: 'assigned_by_name', type: 'varchar', length: 200, nullable: true })
  assignedByName!: string | null;

  @Column({ name: 'assignment_date', type: 'date' })
  assignmentDate!: string;

  @Column({ name: 'revocation_date', type: 'date', nullable: true })
  revocationDate!: string | null;

  @Column({ name: 'last_used_date', type: 'date', nullable: true })
  lastUsedDate!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'activo' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
