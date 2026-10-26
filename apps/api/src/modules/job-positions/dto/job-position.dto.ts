import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MANUAL_STATUSES,
  MAX_DESCRIPTION,
  MAX_LIMIT,
  MAX_OKR_TEXT,
  MAX_TITLE,
  MEASUREMENT_FREQUENCIES,
  PERIOD_REGEX,
  POSITION_STATUSES,
} from '../job-positions.util';


/** Texto recortado; la cadena vacía se vuelve null (opcionales). */
const emptyToNull = Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

/** El código (JP-NNN) NO se recibe: lo genera el servidor; mandarlo da 400 por whitelist. */
export class CreatePositionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  area!: string;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  businessUnit?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(50)
  level?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  description?: string | null;

  @IsOptional()
  @IsIn(MANUAL_STATUSES)
  status?: string;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  businessUnit?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(50)
  level?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  description?: string | null;

  @IsOptional()
  @IsIn(MANUAL_STATUSES)
  status?: string;
}

export class PositionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @IsOptional()
  @IsIn(POSITION_STATUSES)
  status?: (typeof POSITION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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

export class OkrQueryDto {
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2' })
  period?: string;
}

export class CreateOkrDto {
  @Matches(PERIOD_REGEX, { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2' })
  period!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_OKR_TEXT)
  objective!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_OKR_TEXT)
  keyResult!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weight?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOkrDto {
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2' })
  period?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_OKR_TEXT)
  objective?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_OKR_TEXT)
  keyResult?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weight?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateKpiDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  targetValue?: string | null;

  @IsOptional()
  @IsIn(MEASUREMENT_FREQUENCIES)
  measurementFrequency?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateKpiDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  targetValue?: string | null;

  @IsOptional()
  @IsIn(MEASUREMENT_FREQUENCIES)
  measurementFrequency?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
