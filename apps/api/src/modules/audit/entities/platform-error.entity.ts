import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'platform_errors', schema: 'audit' })
export class PlatformError {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  module!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  endpoint!: string | null;

  @Column({ name: 'http_method', type: 'varchar', length: 10, nullable: true })
  httpMethod!: string | null;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus!: number | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_email', type: 'varchar', length: 200, nullable: true })
  userEmail!: string | null;

  @Column({ name: 'request_body', type: 'jsonb', nullable: true })
  requestBody!: Record<string, unknown> | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'varchar', length: 20, default: 'production' })
  environment!: string;

  @Column({ type: 'boolean', default: false })
  resolved!: boolean;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
