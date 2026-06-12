import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsIn(['client', 'employee'])
  appliesTo?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCatalogItemDto extends PartialType(CreateCatalogItemDto) {}
