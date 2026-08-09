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

/**
 * Informativa solo se lee; las de acción esperan aceptar/rechazar.
 *
 * 'atencion' es una acción de una sola vía: quien la recibe confirma que hizo lo
 * suyo ("Atendido") y no puede rechazarla. Se usa para tareas repartidas entre
 * áreas —una baja de empleado, por ejemplo— donde el área no decide si procede,
 * solo acusa que ya la ejecutó.
 */
export type NotificationType = 'informativa' | 'accion' | 'accion_con_nota' | 'atencion';

export type NotificationStatus = 'no_leida' | 'leida' | 'aceptada' | 'rechazada';

@Entity({ name: 'notifications', schema: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipient_id' })
  recipient!: User;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'sender_id' })
  sender!: User | null;

  /** Remitente legible para notificaciones sin usuario detrás ("Sistema"). */
  @Column({ name: 'sender_name', type: 'varchar', length: 200, nullable: true })
  senderName!: string | null;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 20, default: 'informativa' })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 20, default: 'no_leida' })
  status!: NotificationStatus;

  @Column({ name: 'response_note', type: 'text', nullable: true })
  responseNote!: string | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedBy!: string | null;

  /** Módulo que la generó: 'vacaciones' | 'helpdesk' | 'salas'… */
  @Column({ type: 'varchar', length: 50, nullable: true })
  module!: string | null;

  /** Vínculo polimórfico al registro origen — sin FK, ver la migración. */
  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId!: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: true })
  entityType!: string | null;

  @Column({ name: 'action_url', type: 'varchar', length: 500, nullable: true })
  actionUrl!: string | null;

  @Column({ name: 'email_sent', type: 'boolean', default: false })
  emailSent!: boolean;

  @Column({ name: 'email_sent_at', type: 'timestamptz', nullable: true })
  emailSentAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
