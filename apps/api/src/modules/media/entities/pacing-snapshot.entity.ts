import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AdAccount } from './ad-account.entity';
import { MediaBudget } from './budget.entity';

export type PacingStatus = 'green' | 'yellow' | 'red' | 'gray';

@Entity({ name: 'pacing_snapshots', schema: 'media_control' })
export class PacingSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ad_account_id', type: 'uuid' })
  adAccountId!: string;

  @ManyToOne(() => AdAccount)
  @JoinColumn({ name: 'ad_account_id' })
  adAccount!: AdAccount;

  @Column({ name: 'budget_id', type: 'uuid', nullable: true })
  budgetId!: string | null;

  @ManyToOne(() => MediaBudget, { nullable: true })
  @JoinColumn({ name: 'budget_id' })
  budget!: MediaBudget | null;

  @Column({ name: 'snapshot_date', type: 'date', default: () => 'CURRENT_DATE' })
  snapshotDate!: string;

  @Column({ name: 'budget_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  budgetAmount!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency!: string | null;

  @Column({ name: 'spend_accumulated', type: 'decimal', precision: 14, scale: 2, default: 0 })
  spendAccumulated!: string;

  @Column({ name: 'spend_expected', type: 'decimal', precision: 14, scale: 2, nullable: true })
  spendExpected!: string | null;

  @Column({ name: 'spend_daily_avg', type: 'decimal', precision: 14, scale: 2, nullable: true })
  spendDailyAvg!: string | null;

  @Column({ name: 'spend_daily_ideal', type: 'decimal', precision: 14, scale: 2, nullable: true })
  spendDailyIdeal!: string | null;

  @Column({ name: 'spend_daily_remaining', type: 'decimal', precision: 14, scale: 2, nullable: true })
  spendDailyRemaining!: string | null;

  @Column({ name: 'pct_consumed', type: 'decimal', precision: 6, scale: 2, nullable: true })
  pctConsumed!: string | null;

  @Column({ name: 'pacing_pct', type: 'decimal', precision: 6, scale: 2, nullable: true })
  pacingPct!: string | null;

  @Column({ name: 'projected_close', type: 'decimal', precision: 14, scale: 2, nullable: true })
  projectedClose!: string | null;

  @Column({ name: 'projected_exhaustion_date', type: 'date', nullable: true })
  projectedExhaustionDate!: string | null;

  @Column({ name: 'days_remaining', type: 'int', nullable: true })
  daysRemaining!: number | null;

  @Column({ type: 'varchar', length: 10, default: 'gray' })
  status!: PacingStatus;

  @Column({ name: 'calculated_at', type: 'timestamptz', default: () => 'NOW()' })
  calculatedAt!: Date;
}
