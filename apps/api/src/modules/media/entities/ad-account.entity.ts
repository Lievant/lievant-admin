import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientRecord } from '../../clients/entities/client-record.entity';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';
import { ApiCredential } from './api-credential.entity';
import { Platform } from './platform.entity';

@Entity({ name: 'ad_accounts', schema: 'media_control' })
export class AdAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'platform_id', type: 'uuid' })
  platformId!: string;

  @ManyToOne(() => Platform)
  @JoinColumn({ name: 'platform_id' })
  platform!: Platform;

  @Column({ name: 'credential_id', type: 'uuid', nullable: true })
  credentialId!: string | null;

  @ManyToOne(() => ApiCredential, { nullable: true })
  @JoinColumn({ name: 'credential_id' })
  credential!: ApiCredential | null;

  @Column({ name: 'client_record_id', type: 'uuid', nullable: true })
  clientRecordId!: string | null;

  @ManyToOne(() => ClientRecord, { nullable: true })
  @JoinColumn({ name: 'client_record_id' })
  clientRecord!: ClientRecord | null;

  @Column({ name: 'native_account_id', type: 'varchar', length: 200 })
  nativeAccountId!: string;

  @Column({ name: 'native_account_name', type: 'varchar', length: 300, nullable: true })
  nativeAccountName!: string | null;

  @Column({ type: 'varchar', length: 3, default: 'MXN' })
  currency!: string;

  @Column({ type: 'varchar', length: 100, default: 'America/Mexico_City' })
  timezone!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sync_enabled', type: 'boolean', default: true })
  syncEnabled!: boolean;

  @Column({ name: 'account_manager_id', type: 'uuid', nullable: true })
  accountManagerId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'account_manager_id' })
  accountManager!: EmployeeRecord | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;

  @Column({ name: 'last_sync_error', type: 'text', nullable: true })
  lastSyncError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
