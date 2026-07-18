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

export type AuditActionType =
  | 'budget_created'
  | 'budget_adjusted'
  | 'campaign_paused'
  | 'campaign_resumed'
  | 'sync_error'
  | 'token_expired'
  | 'alert_sent'
  | 'alert_acknowledged'
  | 'account_created'
  | 'account_updated'
  | 'sync_triggered';

@Entity({ name: 'audit_log', schema: 'media_control' })
export class MediaAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ad_account_id', type: 'uuid', nullable: true })
  adAccountId!: string | null;

  @ManyToOne(() => AdAccount, { nullable: true })
  @JoinColumn({ name: 'ad_account_id' })
  adAccount!: AdAccount | null;

  @Column({ name: 'action_type', type: 'varchar', length: 50 })
  actionType!: AuditActionType;

  @Column({ name: 'performed_by', type: 'uuid', nullable: true })
  performedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'performed_by' })
  performedByUser!: User | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'before_state', type: 'jsonb', nullable: true })
  beforeState!: Record<string, unknown> | null;

  @Column({ name: 'after_state', type: 'jsonb', nullable: true })
  afterState!: Record<string, unknown> | null;

  @Column({ name: 'native_campaign_id', type: 'varchar', length: 200, nullable: true })
  nativeCampaignId!: string | null;

  @Column({ name: 'native_campaign_name', type: 'varchar', length: 300, nullable: true })
  nativeCampaignName!: string | null;

  @Column({ name: 'api_response', type: 'jsonb', nullable: true })
  apiResponse!: Record<string, unknown> | null;

  @Column({ type: 'boolean', nullable: true })
  success!: boolean | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
