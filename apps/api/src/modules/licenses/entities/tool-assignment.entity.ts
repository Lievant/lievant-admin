import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EmployeeLicense } from './employee-license.entity';
import { ToolCatalog } from './tool-catalog.entity';

@Entity({ name: 'tool_assignments', schema: 'licenses' })
export class ToolAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_license_id', type: 'uuid' })
  employeeLicenseId!: string;

  @ManyToOne(() => EmployeeLicense, { eager: false })
  @JoinColumn({ name: 'employee_license_id' })
  employeeLicense!: EmployeeLicense;

  @Column({ name: 'tool_id', type: 'uuid' })
  toolId!: string;

  @ManyToOne(() => ToolCatalog, { eager: true })
  @JoinColumn({ name: 'tool_id' })
  tool!: ToolCatalog;

  @Column({ name: 'has_access', type: 'boolean', default: false })
  hasAccess!: boolean;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({ name: 'granted_at', type: 'timestamptz', nullable: true })
  grantedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
