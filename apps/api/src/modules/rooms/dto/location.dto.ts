import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Length(2, 3)
  code!: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class CreateCityDto {
  @IsUUID()
  country_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class CreateOfficeDto {
  @IsUUID()
  city_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class UpdateOfficeDto extends PartialType(CreateOfficeDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
