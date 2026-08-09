import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import type { NotificationType } from '../entities/notification.entity';
import { FLOW_RECIPIENT_TYPES, type FlowRecipientType } from '../entities/flow-recipient.entity';

/**
 * `employeeId` y `permissionKey` son opcionales aquí porque solo aplican a un
 * tipo cada uno; el servicio exige el que corresponda y descarta el otro, para
 * que no queden destinatarios con datos contradictorios.
 */
export class CreateFlowRecipientDto {
  @IsIn(FLOW_RECIPIENT_TYPES)
  recipientType!: FlowRecipientType;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  permissionKey?: string;

  @IsOptional()
  @IsIn(['informativa', 'accion', 'accion_con_nota', 'atencion'])
  notificationType?: NotificationType;

  /** Rol en el flujo ('TI', 'CORE', 'Operaciones'…). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
