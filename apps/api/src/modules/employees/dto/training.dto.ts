import { Transform, Type } from 'class-transformer';
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
  ValidateIf,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { DEVELOPMENT_TYPES, DURATION_UNITS, TRAINING_LEVELS, normalizeCompetencyIds } from '../trainings.util';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Arreglo de ids de competencia válido (1 a 30, UUID, sin repetidos); da UN solo mensaje claro en español. */
function IsCompetencyIds(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isCompetencyIds',
      target: target.constructor,
      propertyName: propertyName as string,
      ...(options ? { options } : {}),
      validator: {
        validate: (value: unknown) => {
          try {
            normalizeCompetencyIds(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage: (args) => {
          try {
            normalizeCompetencyIds(args?.value);
            return '';
          } catch (e) {
            return (e as Error).message;
          }
        },
      },
    });
}

/** Paso 1: el navegador pide la URL prefirmada antes de subir el certificado a S3. */
export class CertificateUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;
}

/** Paso 3: el certificado ya está en S3; se adjunta a la capacitación al guardarla. */
export class CertificateRefDto extends CertificateUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  s3Key!: string;
}

export class CreateTrainingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institution!: string;

  @IsIn(DEVELOPMENT_TYPES)
  developmentType!: string;

  @IsOptional()
  @IsIn(TRAINING_LEVELS)
  level?: string | null;

  @Matches(ISO_DAY, { message: 'La fecha de inicio debe tener formato AAAA-MM-DD' })
  startDate!: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'La fecha de fin debe tener formato AAAA-MM-DD' })
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  durationValue?: number | null;

  @IsOptional()
  @IsIn(DURATION_UNITS)
  durationUnit?: string | null;

  /** Competencias del catálogo: al menos 1, hasta 30 y sin repetidas (mismo criterio y mensajes que el servicio). */
  @IsCompetencyIds()
  competencyIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  notes?: string | null;

  /** Certificado ya subido a S3. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateRefDto)
  certificate?: CertificateRefDto | null;
}

/** PATCH: todos opcionales; `null` limpia fecha de fin, nivel, duración, notas y certificado. */
export class UpdateTrainingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institution?: string;

  @IsOptional()
  @IsIn(DEVELOPMENT_TYPES)
  developmentType?: string;

  @IsOptional()
  @IsIn(TRAINING_LEVELS)
  level?: string | null;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'La fecha de inicio debe tener formato AAAA-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'La fecha de fin debe tener formato AAAA-MM-DD' })
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  durationValue?: number | null;

  @IsOptional()
  @IsIn(DURATION_UNITS)
  durationUnit?: string | null;

  /** Si se envía reemplaza el conjunto completo (mínimo 1); si no se envía se conservan las actuales. */
  @ValidateIf((o: UpdateTrainingDto) => o.competencyIds !== undefined)
  @IsCompetencyIds()
  competencyIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CertificateRefDto)
  certificate?: CertificateRefDto | null;
}

/** Filtros del listado (`?type=&year=`). */
export class TrainingQueryDto {
  @IsOptional()
  @IsIn(DEVELOPMENT_TYPES)
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;
}
