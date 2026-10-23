import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { RIAC_MAX_LIMIT, RIAC_TYPES } from '../trainings-report.util';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros del RIAC. Desde y Hasta son obligatorios; su coherencia la valida el servicio. */
export class TrainingReportQueryDto {
  @Matches(ISO_DAY, { message: 'Desde debe tener formato AAAA-MM-DD' })
  from!: string;

  @Matches(ISO_DAY, { message: 'Hasta debe tener formato AAAA-MM-DD' })
  to!: string;

  @IsOptional()
  @IsIn(RIAC_TYPES)
  type?: (typeof RIAC_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  division?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RIAC_MAX_LIMIT)
  limit?: number;
}
