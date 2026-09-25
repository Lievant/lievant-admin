import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'user_sessions', schema: 'audit' })
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_email', type: 'varchar', length: 200, nullable: true })
  userEmail!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department!: string | null;

  @Column({ name: 'login_at', type: 'timestamptz' })
  loginAt!: Date;

  @Column({ name: 'last_activity_at', type: 'timestamptz' })
  lastActivityAt!: Date;

  @Column({ name: 'logout_at', type: 'timestamptz', nullable: true })
  logoutAt!: Date | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes!: number | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  /** Módulos distintos tocados durante la sesión, para analytics de uso. */
  @Column({ name: 'modules_visited', type: 'jsonb', default: [] })
  modulesVisited!: string[];
}
