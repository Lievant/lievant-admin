import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Cambio de categoría y subcategoría de un ticket (solo TD). */
export class ChangeTicketCategoryDto {
  @IsString()
  @MaxLength(50)
  category!: string;

  /** Nombre de la subcategoría del catálogo; null o vacío = sin subcategoría. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(100)
  subcategory?: string | null;
}
