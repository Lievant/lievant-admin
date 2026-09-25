import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'user_activity', schema: 'audit' })
export class UserActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_email', type: 'varchar', length: 200, nullable: true })
  userEmail!: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 200, nullable: true })
  userName!: string | null;

  /** Área del colaborador al momento del hecho, no la actual. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  department!: string | null;

  @Column({ type: 'varchar', length: 50 })
  action!: string;

  @Column({ type: 'varchar', length: 100 })
  module!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100, nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 200, nullable: true })
  entityId!: string | null;

  @Column({ name: 'entity_name', type: 'varchar', length: 500, nullable: true })
  entityName!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
