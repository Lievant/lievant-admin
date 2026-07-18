import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AdAccount } from './ad-account.entity';
import { Platform } from './platform.entity';

export type SyncType = 'daily_spend' | 'campaigns' | 'pacing';
export type SyncStatus = 'running' | 'success' | 'error' | 'partial';

@Entity({ name: 'sync_logs', schema: 'media_control' })
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'platform_id', type: 'uuid', nullable: true })
  platformId!: string | null;

  @ManyToOne(() => Platform, { nullable: true })
  @JoinColumn({ name: 'platform_id' })
  platform!: Platform | null;

  @Column({ name: 'ad_account_id', type: 'uuid', nullable: true })
  adAccountId!: string | null;

  @ManyToOne(() => AdAccount, { nullable: true })
  @JoinColumn({ name: 'ad_account_id' })
  adAccount!: AdAccount | null;

  @Column({ name: 'sync_type', type: 'varchar', length: 50 })
  syncType!: SyncType;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' })
  startedAt!: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: SyncStatus;

  @Column({ name: 'records_fetched', type: 'int', default: 0 })
  recordsFetched!: number;

  @Column({ name: 'records_saved', type: 'int', default: 0 })
  recordsSaved!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
