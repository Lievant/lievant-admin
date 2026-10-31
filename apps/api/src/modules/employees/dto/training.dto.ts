import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DEVELOPMENT_TYPES, DURATION_UNITS, MAX_COMPETENCIES, TRAINING_LEVELS } from '../trainings.util';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

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

  /** Competencias del catálogo: al menos 1, hasta 30 y sin repetidas. */
  @IsArray({ message: 'Selecciona al menos una competencia' })
  @ArrayMinSize(1, { message: 'Selecciona al menos una competencia' })
  @ArrayMaxSize(MAX_COMPETENCIES, { message: `Una capacitación no puede tener más de ${MAX_COMPETENCIES} competencias` })
  @ArrayUnique({ message: 'Hay competencias repetidas' })
  @IsUUID('all', { each: true, message: 'Alguna competencia elegida no es válida' })
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
  @IsArray({ message: 'Selecciona al menos una competencia' })
  @ArrayMinSize(1, { message: 'Selecciona al menos una competencia' })
  @ArrayMaxSize(MAX_COMPETENCIES, { message: `Una capacitación no puede tener más de ${MAX_COMPETENCIES} competencias` })
  @ArrayUnique({ message: 'Hay competencias repetidas' })
  @IsUUID('all', { each: true, message: 'Alguna competencia elegida no es válida' })
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
