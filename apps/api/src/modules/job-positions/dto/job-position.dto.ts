import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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
  ACTIVITY_FREQUENCIES,
  MAX_TITLE,
  MEASUREMENT_FREQUENCIES,
  POSITION_SORT_COLUMNS,
  POSITION_STATUSES,
  SORT_DIRECTIONS,
  VALIDATION_STATUSES,
} from '../job-positions.util';
import { SENIORITIES } from '../job-positions-catalog.util';


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
  @emptyToNull
  @IsIn(SENIORITIES, { message: 'La categoría debe ser Junior, Semi Senior o Senior' })
  seniority?: string | null;


  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  division?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  meotHierarchy?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(500)
  reportsTo?: string | null;

  /** «Reporta a» como empleado (null lo quita). El texto del Excel (`reportsTo`) no se edita desde el formulario. */
  @IsOptional()
  @emptyToNull
  @IsUUID()
  reportsToEmployeeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  plazas?: number | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  roleSummary?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  positionObjective?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  validationPoints?: string | null;

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
  @emptyToNull
  @IsIn(SENIORITIES, { message: 'La categoría debe ser Junior, Semi Senior o Senior' })
  seniority?: string | null;


  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  division?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  meotHierarchy?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(500)
  reportsTo?: string | null;

  /** «Reporta a» como empleado (null lo quita). El texto del Excel (`reportsTo`) no se edita desde el formulario. */
  @IsOptional()
  @emptyToNull
  @IsUUID()
  reportsToEmployeeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  plazas?: number | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  roleSummary?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  positionObjective?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  validationPoints?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  headComments?: string | null;

  @IsOptional()
  @IsIn(VALIDATION_STATUSES)
  validationStatus?: (typeof VALIDATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION)
  description?: string | null;

  @IsOptional()
  @IsIn(MANUAL_STATUSES)
  status?: string;
}

export class PositionQueryDto {
  /** Columna de orden (lista cerrada); sin ella se conserva el orden de siempre. */
  @IsOptional()
  @IsIn(POSITION_SORT_COLUMNS, { message: 'La columna de orden no es válida' })
  sortBy?: (typeof POSITION_SORT_COLUMNS)[number];

  @IsOptional()
  @IsIn(SORT_DIRECTIONS, { message: 'El sentido del orden debe ser asc o desc' })
  sortDir?: (typeof SORT_DIRECTIONS)[number];

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
  @MaxLength(100)
  division?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  seniority?: string;

  @IsOptional()
  @IsIn(POSITION_STATUSES)
  status?: (typeof POSITION_STATUSES)[number];

  @IsOptional()
  @IsIn(VALIDATION_STATUSES)
  validationStatus?: (typeof VALIDATION_STATUSES)[number];

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

const OKR_PERIOD_REGEX = /^([0-9]{4}-S[12]|base)$/;

export class OkrQueryDto {
  @IsOptional()
  @Matches(OKR_PERIOD_REGEX, { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2 (o «base» para la plantilla)' })
  period?: string;
}

export class CreateOkrDto {
  /** Vacío o «base» = plantilla (sin periodo). */
  @IsOptional()
  @emptyToNull
  @Matches(OKR_PERIOD_REGEX, { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2 (o «base» para la plantilla)' })
  period?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(10)
  objectiveCode?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(10)
  krCode?: string | null;

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
  @emptyToNull
  @Matches(OKR_PERIOD_REGEX, { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2 (o «base» para la plantilla)' })
  period?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(10)
  objectiveCode?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(10)
  krCode?: string | null;

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

export class CreateActivityDto {
  @IsInt()
  @Min(1)
  groupOrder!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  groupTitle!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_OKR_TEXT)
  description!: string;

  @IsOptional()
  @emptyToNull
  @IsIn(ACTIVITY_FREQUENCIES)
  frequency?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_OKR_TEXT)
  note?: string | null;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  groupOrder?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  groupTitle?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_OKR_TEXT)
  description?: string;

  @IsOptional()
  @emptyToNull
  @IsIn(ACTIVITY_FREQUENCIES)
  frequency?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(MAX_OKR_TEXT)
  note?: string | null;
}

export class ImportBodyDto {
  @IsIn(['preview', 'apply'])
  mode!: 'preview' | 'apply';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  division!: string;
}

export class CreateAreaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  division!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  /** Confirma crear un área «casi igual» a otra ya existente. */
  @IsOptional()
  @IsBoolean()
  confirmSimilar?: boolean;
}

export class EmployeeSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
