import { Transform, Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_COMMENTS, MAX_LIMIT } from '../okr-evaluations.util';

const PERIOD = /^[0-9]{4}-S[12]$/;
const MSG = { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2' };

export class PeriodQueryDto {
  @IsOptional()
  @Matches(PERIOD, MSG)
  period?: string;
}

/** `undefined` = no cambia; `null` = limpia. La calificación admite 0–100 con dos decimales. */
export class SaveEvaluationDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La calificación admite hasta dos decimales' })
  @Min(0, { message: 'La calificación debe estar entre 0 y 100' })
  @Max(100, { message: 'La calificación debe estar entre 0 y 100' })
  score?: number | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @IsString()
  @MaxLength(MAX_COMMENTS, { message: `Los comentarios no pueden pasar de ${MAX_COMMENTS} caracteres` })
  comments?: string | null;
}

export class ReportQueryDto {
  @IsOptional()
  @Matches(PERIOD, MSG)
  period?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

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
  @Max(MAX_LIMIT)
  limit?: number;
}
