import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AdAccount } from './ad-account.entity';

export type SpendDataSource = 'api' | 'manual' | 'estimated';

@Entity({ name: 'daily_spend', schema: 'media_control' })
export class DailySpend {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ad_account_id', type: 'uuid' })
  adAccountId!: string;

  @ManyToOne(() => AdAccount)
  @JoinColumn({ name: 'ad_account_id' })
  adAccount!: AdAccount;

  @Column({ name: 'spend_date', type: 'date' })
  spendDate!: string;

  @Column({ name: 'spend_native', type: 'decimal', precision: 14, scale: 4, default: 0 })
  spendNative!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 10, scale: 6, default: 1 })
  exchangeRate!: string;

  @Column({ name: 'spend_mxn', type: 'decimal', precision: 14, scale: 4, nullable: true })
  spendMxn!: string | null;

  @Column({ name: 'data_source', type: 'varchar', length: 50, default: 'api' })
  dataSource!: SpendDataSource;

  @Column({ name: 'api_response_id', type: 'varchar', length: 200, nullable: true })
  apiResponseId!: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' })
  recordedAt!: Date;
}
