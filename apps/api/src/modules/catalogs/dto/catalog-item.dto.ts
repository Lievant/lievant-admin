import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCatalogItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  companyCode?: string;

  @IsOptional()
  @IsString()
  divisionName?: string;

  /**
   * A qué entidad aplica el tipo de documento.
   *
   * La columna es varchar libre y no hay CHECK en la base, así que esta lista
   * es la única validación real. Se quedó en client/employee y nunca se amplió
   * al añadir proveedores ni proyectos, de modo que editar cualquiera de esos
   * tipos desde el catálogo devolvía un 400 pese a existir ya en la tabla.
   */
  @IsOptional()
  @IsIn(['client', 'employee', 'vendor', 'project'])
  appliesTo?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  // Solo para el catálogo de festivos (catalogs.holidays)
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateCatalogItemDto extends PartialType(CreateCatalogItemDto) {}
