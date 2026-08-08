import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class QueryNotificationsDto {
  /**
   * 'pendientes' no es un status de la tabla: agrupa las notificaciones de
   * acción sin responder, que es como las pide el filtro de la UI.
   */
  @IsOptional()
  @IsIn(['no_leida', 'leida', 'aceptada', 'rechazada', 'informativa', 'pendientes'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
