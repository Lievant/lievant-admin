import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Alta de una solicitud por parte de RRHH en nombre de un colaborador. */
export class AdminCreateVacationRequestDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  // Acepta el booleano de un body JSON y también 'true'/'false' si llegara como texto.
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  autoApprove?: boolean;
}
