import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVacationDto {
  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taken?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  supportActivityDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateVacationDto extends PartialType(CreateVacationDto) {}
