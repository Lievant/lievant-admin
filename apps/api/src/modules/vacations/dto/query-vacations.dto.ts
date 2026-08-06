import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CalculateDaysDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  // Opcional: id del empleado para usar sus work_days. Si no viene, se usa
  // el empleado del usuario autenticado.
  @IsOptional()
  employeeId?: string;
}

export class HolidaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

export class VacationReportQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class VacationMasterQueryDto {
  /** Busca en full_name o display_id. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Acota a empleados cuyo próximo aniversario cae dentro del período. */
  @IsOptional()
  @IsIn(['week', 'month', 'quarter'])
  anniversary_within?: 'week' | 'month' | 'quarter';
}
