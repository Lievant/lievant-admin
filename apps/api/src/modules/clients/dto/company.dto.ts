import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  rfc?: string;

  @IsOptional()
  @IsString()
  industry?: string;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}
