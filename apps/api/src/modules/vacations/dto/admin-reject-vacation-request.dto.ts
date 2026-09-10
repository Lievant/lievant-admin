import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A diferencia de RejectVacationRequestDto (el rechazo del jefe directo, donde
 * el motivo es obligatorio), aquí la nota es opcional: RRHH suele tumbar una
 * solicitud por una razón administrativa que ya consta en otro lado.
 */
export class AdminRejectVacationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
