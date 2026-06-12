import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTerminationDto {
  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  severancePaid?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  severanceAmount?: number;

  @IsOptional()
  @IsString()
  references?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
