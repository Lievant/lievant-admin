import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ACTION_STATUSES,
  CONTROL_EFFICACIES,
  SCORE_MAX,
  SCORE_MIN,
} from '../risk-calculation';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'La fecha debe tener el formato AAAA-MM-DD.';
const LONG_TEXT = 5000;

/**
 * `riskValue` y `residualRisk` no existen aquí a propósito: se calculan siempre
 * en el servidor, y con `forbidNonWhitelisted` mandarlos es un error 400.
 */
export class CreateRiskDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La categoría es obligatoria.' })
  @MaxLength(100)
  category!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La amenaza es obligatoria.' })
  @MaxLength(300)
  threat!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La vulnerabilidad es obligatoria.' })
  @MaxLength(300)
  vulnerability!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El activo afectado es obligatorio.' })
  @MaxLength(200)
  affectedAsset!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El riesgo es obligatorio.' })
  @MaxLength(LONG_TEXT)
  risk!: string;

  @IsInt({ message: 'La vulnerabilidad debe ser un entero de 1 a 5.' })
  @Min(SCORE_MIN)
  @Max(SCORE_MAX)
  vulnerabilityScore!: number;

  @IsInt({ message: 'La severidad debe ser un entero de 1 a 5.' })
  @Min(SCORE_MIN)
  @Max(SCORE_MAX)
  severityScore!: number;

  @IsInt({ message: 'La probabilidad debe ser un entero de 1 a 5.' })
  @Min(SCORE_MIN)
  @Max(SCORE_MAX)
  probabilityScore!: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El control es obligatorio.' })
  @MaxLength(LONG_TEXT)
  control!: string;

  @IsIn([...CONTROL_EFFICACIES], { message: 'La eficacia del control debe ser 0.1, 0.2, 0.3, 0.4 o 0.5.' })
  controlEfficacy!: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El dueño es obligatorio.' })
  @MaxLength(200)
  owner!: string;

  @IsIn([...ACTION_STATUSES], { message: 'El estado de la acción no es válido.' })
  actionStatus!: string;

  /** Opcional; si falta al crear, se usa la fecha de hoy en hora de México. */
  @IsOptional()
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  reportedAt?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(LONG_TEXT)
  mitigationStrategy?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(LONG_TEXT)
  actions?: string | null;

  /** Opcional; `null` la borra. */
  @IsOptional()
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  estimatedResolutionDate?: string | null;
}

export class UpdateRiskDto extends PartialType(CreateRiskDto) {}
