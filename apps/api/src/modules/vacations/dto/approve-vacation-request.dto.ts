import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * La nota es opcional: aprobar sin comentario es el caso normal y exigir texto
 * frenaría el flujo de un click que ya existía antes de esta columna.
 */
export class ApproveVacationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
