import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Qué se audita y por cuánto tiempo, por módulo. Es la palanca que permite
 * apagar el log de un módulo ruidoso sin tocar código ni redesplegar.
 */
@Entity({ name: 'module_config', schema: 'audit' })
export class AuditModuleConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  module!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ name: 'audit_enabled', type: 'boolean', default: true })
  auditEnabled!: boolean;

  @Column({ name: 'log_reads', type: 'boolean', default: false })
  logReads!: boolean;

  @Column({ name: 'log_writes', type: 'boolean', default: true })
  logWrites!: boolean;

  @Column({ name: 'retention_days', type: 'int', default: 365 })
  retentionDays!: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
