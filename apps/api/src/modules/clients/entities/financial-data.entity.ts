import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientRecord } from './client-record.entity';

@Entity({ name: 'financial_data', schema: 'clients' })
export class FinancialData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_record_id', type: 'uuid', unique: true })
  clientRecordId!: string;

  @OneToOne(() => ClientRecord)
  @JoinColumn({ name: 'client_record_id' })
  clientRecord!: ClientRecord;

  @Column({ name: 'payment_days', type: 'int', nullable: true })
  paymentDays!: number | null;

  @Column({ name: 'billing_email', type: 'varchar', length: 200, nullable: true })
  billingEmail!: string | null;

  @Column({ name: 'billing_contact', type: 'varchar', length: 200, nullable: true })
  billingContact!: string | null;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  creditLimit!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'MXN' })
  currency!: string | null;

  @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
  paymentMethod!: string | null;

  @Column({ name: 'sat_payment_method', type: 'varchar', length: 10, nullable: true })
  satPaymentMethod!: string | null;

  @Column({ name: 'sat_payment_form', type: 'varchar', length: 10, nullable: true })
  satPaymentForm!: string | null;

  @Column({ name: 'sat_cfdi_use', type: 'varchar', length: 10, nullable: true })
  satCfdiUse!: string | null;

  @Column({ name: 'sat_tax_regime', type: 'varchar', length: 10, nullable: true })
  satTaxRegime!: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName!: string | null;

  @Column({ name: 'bank_account', type: 'varchar', length: 50, nullable: true })
  bankAccount!: string | null;

  @Column({ name: 'bank_clabe', type: 'varchar', length: 20, nullable: true })
  bankClabe!: string | null;

  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate!: string | null;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate!: string | null;

  @Column({ name: 'auto_renewal', type: 'boolean', default: false })
  autoRenewal!: boolean;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
