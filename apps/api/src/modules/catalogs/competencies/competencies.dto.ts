import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_DESCRIPTION, MAX_NAME, MAX_SORT_ORDER } from './competencies.util';

export class CreateCompetencyDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(MAX_NAME, { message: `El nombre no puede pasar de ${MAX_NAME} caracteres.` })
  name!: string;

  /** Opcional; vacío = sin descripción. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION, { message: `La descripción no puede pasar de ${MAX_DESCRIPTION} caracteres.` })
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SORT_ORDER)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCompetencyDto extends PartialType(CreateCompetencyDto) {}

export class ImportBodyDto {
  @IsIn(['preview', 'apply'])
  mode!: 'preview' | 'apply';
}
