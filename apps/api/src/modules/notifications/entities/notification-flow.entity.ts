import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FlowRecipient } from './flow-recipient.entity';

/**
 * Un flujo por par (módulo, evento). El módulo lo dispara por ese par y nunca
 * por id, para que crear el flujo y dispararlo no queden acoplados.
 */
@Entity({ name: 'notification_flows', schema: 'notifications' })
export class NotificationFlow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  module!: string;

  @Column({ type: 'varchar', length: 50 })
  event!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => FlowRecipient, (recipient) => recipient.flow)
  recipients!: FlowRecipient[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
