import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const TICKET_PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export class UpsertCategoryDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  /** Opcional: si no viene, se deriva del nombre. Solo se usa al crear. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  slug?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES as unknown as string[])
  priorityBase?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  slaResponseHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2000)
  slaResolutionHours?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertSubcategoryDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name!: string;

  /** Solo en edición: mover la subcategoría a otra categoría padre. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  categorySlug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
