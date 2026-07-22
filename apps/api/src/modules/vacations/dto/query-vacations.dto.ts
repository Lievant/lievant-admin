import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

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
