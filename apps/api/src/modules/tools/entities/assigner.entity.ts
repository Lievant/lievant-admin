import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Catálogo de quién puede asignar herramientas.
 *
 * Es una lista corta y configurable, no un EmployeePicker libre: el campo
 * "Asignado por" tiene que ser auditable y no admitir cualquier nombre.
 */
@Entity({ name: 'assigners', schema: 'tools' })
export class Assigner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
