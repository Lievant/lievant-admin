import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type VacationMovementType =
  | 'PERIOD_START'
  | 'PERIOD_EXPIRY'
  | 'REQUEST_APPROVED'
  | 'REQUEST_CANCELLED'
  | 'MANUAL_ADJUSTMENT';

@Entity({ name: 'vacation_movements', schema: 'hr' })
export class VacationMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'balance_id', type: 'uuid', nullable: true })
  balanceId!: string | null;

  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId!: string | null;

  @Column({ name: 'movement_type', type: 'varchar', length: 30 })
  movementType!: VacationMovementType;

  @Column({ name: 'days_delta', type: 'decimal', precision: 6, scale: 2 })
  daysDelta!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
