import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { NotificationType } from '../entities/notification.entity';

/**
 * DTO de uso interno: lo consumen otros módulos (vacaciones, helpdesk…) al
 * generar una notificación. No se expone en ningún endpoint, porque permitir
 * que un cliente elija el destinatario sería un canal para spamear a cualquiera.
 */
export class CreateNotificationDto {
  @IsUUID()
  recipientId!: string;

  @IsOptional()
  @IsUUID()
  senderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  senderName?: string;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsString()
  message!: string;

  @IsIn(['informativa', 'accion', 'accion_con_nota'])
  type!: NotificationType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;
}
