import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { AdAccount } from './ad-account.entity';

export type AlertType =
  | 'no_budget'
  | 'pacing_yellow'
  | 'pacing_red'
  | 'exhaustion_7d'
  | 'budget_exhausted'
  | 'budget_exceeded'
  | 'stale_data'
  | 'pause_failed';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

@Entity({ name: 'alerts', schema: 'media_control' })
export class MediaAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ad_account_id', type: 'uuid' })
  adAccountId!: string;

  @ManyToOne(() => AdAccount)
  @JoinColumn({ name: 'ad_account_id' })
  adAccount!: AdAccount;

  @Column({ name: 'alert_type', type: 'varchar', length: 50 })
  alertType!: AlertType;

  @Column({ type: 'varchar', length: 10 })
  severity!: AlertSeverity;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: AlertStatus;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedByUser!: User | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt!: Date | null;

  @Column({ name: 'notification_channels', type: 'jsonb', nullable: true })
  notificationChannels!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
