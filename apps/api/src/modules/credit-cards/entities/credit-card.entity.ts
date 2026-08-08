import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';

@Entity({ name: 'credit_cards', schema: 'expenses' })
export class CreditCard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Solo los últimos 4: el número completo no se almacena nunca. */
  @Column({ name: 'last_four', type: 'varchar', length: 4 })
  lastFour!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  alias!: string | null;

  @Column({ name: 'holder_employee_id', type: 'uuid' })
  holderEmployeeId!: string;

  @ManyToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'holder_employee_id' })
  holderEmployee!: EmployeeRecord;

  @Column({ name: 'holder_user_id', type: 'uuid', nullable: true })
  holderUserId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'holder_user_id' })
  holderUser!: User | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
