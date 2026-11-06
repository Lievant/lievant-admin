import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { COUNTRIES, MAX_LIMIT, MODALITIES, PRIORITIES, REQUISITION_TYPES, REVIEWABLE_STATUSES, STATUSES } from '../job-requisitions.util';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const emptyToNull = Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

/**
 * Cuerpo de borrador. En borrador solo se exige el tipo; lo demás se valida al
 * ENVIAR. `null` limpia un campo al editar. El estado, el código y el solicitante
 * no se reciben: salen del servidor y de la sesión (whitelist rechaza si llegan).
 */
export class CreateRequisitionDto {
  @IsIn(REQUISITION_TYPES)
  type!: string;

  @IsOptional()
  @IsUUID()
  jobPositionId?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(200)
  positionTitle?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  area?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  reason?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  businessJustification?: string | null;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'La fecha requerida debe tener formato AAAA-MM-DD' })
  requiredDate?: string | null;

  @IsOptional()
  @IsIn(MODALITIES)
  modality?: string | null;

  @IsOptional()
  @IsIn(COUNTRIES)
  country?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  basicProfile?: string | null;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string | null;
}

export class UpdateRequisitionDto {
  @IsOptional()
  @IsIn(REQUISITION_TYPES)
  type?: string;

  @IsOptional()
  @IsUUID()
  jobPositionId?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(200)
  positionTitle?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(100)
  area?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  reason?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  businessJustification?: string | null;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'La fecha requerida debe tener formato AAAA-MM-DD' })
  requiredDate?: string | null;

  @IsOptional()
  @IsIn(MODALITIES)
  modality?: string | null;

  @IsOptional()
  @IsIn(COUNTRIES)
  country?: string | null;

  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  basicProfile?: string | null;

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: string | null;
}

export class MyRequisitionsQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;

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

export class ReviewQueryDto {
  @IsOptional()
  @IsIn(REVIEWABLE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'Desde debe tener formato AAAA-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'Hasta debe tener formato AAAA-MM-DD' })
  to?: string;

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

export class ApproveRequisitionDto {
  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000)
  comments?: string | null;
}

/** Los comentarios son obligatorios al rechazar; se exige en el servicio para dar un solo mensaje claro. */
export class RejectRequisitionDto {
  @IsOptional()
  @emptyToNull
  @IsString()
  @MaxLength(5000, { message: 'Los comentarios no pueden pasar de 5,000 caracteres' })
  comments?: string | null;
}
