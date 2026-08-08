import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';
import type { NotificationType } from './notification.entity';
import { NotificationFlow } from './notification-flow.entity';

/**
 * - `jefe_inmediato` y `solicitante` se resuelven contra el contexto del evento.
 * - `empleado` usa employeeId.
 * - `permiso` usa permissionKey ('seccion.modulo.accion') y puede resolver a
 *   varios usuarios.
 */
export type FlowRecipientType = 'jefe_inmediato' | 'solicitante' | 'empleado' | 'permiso';

export const FLOW_RECIPIENT_TYPES: FlowRecipientType[] = [
  'jefe_inmediato',
  'solicitante',
  'empleado',
  'permiso',
];

@Entity({ name: 'flow_recipients', schema: 'notifications' })
export class FlowRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'flow_id', type: 'uuid' })
  flowId!: string;

  @ManyToOne(() => NotificationFlow, (flow) => flow.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flow_id' })
  flow!: NotificationFlow;

  @Column({ name: 'recipient_type', type: 'varchar', length: 30 })
  recipientType!: FlowRecipientType;

  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId!: string | null;

  @ManyToOne(() => EmployeeRecord, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord | null;

  /** 'seccion.modulo.accion', p. ej. 'rrhh.vacaciones.manage'. */
  @Column({ name: 'permission_key', type: 'varchar', length: 100, nullable: true })
  permissionKey!: string | null;

  @Column({ name: 'notification_type', type: 'varchar', length: 20, default: 'informativa' })
  notificationType!: NotificationType;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
