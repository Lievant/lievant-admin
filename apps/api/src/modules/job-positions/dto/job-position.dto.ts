import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  registerDecorator,
} from 'class-validator';
import {
  MANUAL_STATUSES,
  MAX_DESCRIPTION,
  MAX_LIMIT,
  MAX_OKR_TEXT,
  AI_LEVELS,
  MAX_OKR_WEIGHT,
  MIN_OKR_WEIGHT,
  OKR_WEIGHT_MESSAGE,
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
  @MaxLength(500)
  reportsTo?: string | null;

  /** «Reporta a» como empleado (null lo quita). El texto del Excel (`reportsTo`) no se edita desde el formulario. */
  @IsOptional()
  @emptyToNull
  @IsUUID()
  reportsToEmployeeId?: string | null;

  /** «Reporta a» como puesto de la misma matriz (null lo quita). */
  @IsOptional()
  @emptyToNull
  @IsUUID()
  reportsToPositionId?: string | null;

  /** «Supervisa a»: puestos supervisados. Reemplaza el conjunto (`[]` lo vacía); sin repetidos, máximo 50. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  supervisesPositionIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  plazas?: number | null;

  /** Vacantes (entero ≥ 0; por omisión 0). No puede ser null. */
  @ValidateIf((o: { vacancies?: unknown }) => o.vacancies !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  vacancies?: number;

  /** Competencia IA (nivel): básico, intermedio o avanzado; null la quita. */
  @IsOptional()
  @emptyToNull
  @IsIn(AI_LEVELS, { message: 'La competencia IA debe ser básico, intermedio o avanzado' })
  aiCompetencyLevel?: string | null;

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
  @MaxLength(500)
  reportsTo?: string | null;

  /** «Reporta a» como empleado (null lo quita). El texto del Excel (`reportsTo`) no se edita desde el formulario. */
  @IsOptional()
  @emptyToNull
  @IsUUID()
  reportsToEmployeeId?: string | null;

  /** «Reporta a» como puesto de la misma matriz (null lo quita). */
  @IsOptional()
  @emptyToNull
  @IsUUID()
  reportsToPositionId?: string | null;

  /** «Supervisa a»: puestos supervisados. Reemplaza el conjunto (`[]` lo vacía); sin repetidos, máximo 50. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  supervisesPositionIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  plazas?: number | null;

  /** Vacantes (entero ≥ 0; por omisión 0). No puede ser null. */
  @ValidateIf((o: { vacancies?: unknown }) => o.vacancies !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  vacancies?: number;

  /** Competencia IA (nivel): básico, intermedio o avanzado; null la quita. */
  @IsOptional()
  @emptyToNull
  @IsIn(AI_LEVELS, { message: 'La competencia IA debe ser básico, intermedio o avanzado' })
  aiCompetencyLevel?: string | null;

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

const OKR_PERIOD_REGEX = /^[0-9]{4}-S[12]$/;
const OKR_PERIOD_MESSAGE = 'El periodo debe tener formato AAAA-S1 o AAAA-S2';

/** El peso llega como número o como texto numérico: se convierte; lo demás se deja tal cual para que la validación lo rechace. */
/** Entero de 1 a 100; da UN solo mensaje (no uno por cada regla). */
function IsOkrWeight(): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isOkrWeight',
      target: target.constructor,
      propertyName: propertyName as string,
      validator: {
        validate: (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= MIN_OKR_WEIGHT && value <= MAX_OKR_WEIGHT,
        defaultMessage: () => OKR_WEIGHT_MESSAGE,
      },
    });
}

const toWeight = Transform(({ value }) => (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value));

export class OkrQueryDto {
  @IsOptional()
  @Matches(OKR_PERIOD_REGEX, { message: OKR_PERIOD_MESSAGE })
  period?: string;
}

export class CreateOkrDto {
  /** Semestre obligatorio (AAAA-S1 o AAAA-S2): ya no hay plantilla sin periodo. */
  @Matches(OKR_PERIOD_REGEX, { message: OKR_PERIOD_MESSAGE })
  period!: string;

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

  /** Obligatorio: entero de 1 a 100 (activo o no). */
  @toWeight
  @IsOkrWeight()
  weight!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Copia de los OKRs activos de un semestre a otro. */
export class CopyOkrsDto {
  @Matches(OKR_PERIOD_REGEX, { message: OKR_PERIOD_MESSAGE })
  fromPeriod!: string;

  @Matches(OKR_PERIOD_REGEX, { message: OKR_PERIOD_MESSAGE })
  toPeriod!: string;
}

export class UpdateOkrDto {
  /** Si viene no puede ser null ni vacío. */
  @ValidateIf((o: UpdateOkrDto) => o.period !== undefined)
  @Matches(OKR_PERIOD_REGEX, { message: OKR_PERIOD_MESSAGE })
  period?: string;

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

  /** Si viene no puede ser null: entero de 1 a 100. */
  @ValidateIf((o: UpdateOkrDto) => o.weight !== undefined)
  @toWeight
  @IsOkrWeight()
  weight?: number;

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

  /** Semestre (AAAA-S1 o AAAA-S2) en el que se crean los OKRs nuevos y sobre el que se comparan los existentes. */
  @Matches(OKR_PERIOD_REGEX, { message: OKR_PERIOD_MESSAGE })
  period!: string;

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
