import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Platform } from './platform.entity';

export type CredentialType = 'system_token' | 'oauth2' | 'oauth1a' | 'developer_token';

@Entity({ name: 'api_credentials', schema: 'media_control' })
export class ApiCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'platform_id', type: 'uuid' })
  platformId!: string;

  @ManyToOne(() => Platform)
  @JoinColumn({ name: 'platform_id' })
  platform!: Platform;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'secret_arn', type: 'varchar', length: 500 })
  secretArn!: string;

  @Column({ name: 'credential_type', type: 'varchar', length: 50 })
  credentialType!: CredentialType;

  @Column({ name: 'mcc_account_id', type: 'varchar', length: 100, nullable: true })
  mccAccountId!: string | null;

  @Column({ name: 'business_account_id', type: 'varchar', length: 100, nullable: true })
  businessAccountId!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_verified_at', type: 'timestamptz', nullable: true })
  lastVerifiedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser!: User | null;
}
