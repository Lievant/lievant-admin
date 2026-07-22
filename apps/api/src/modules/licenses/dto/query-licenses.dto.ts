import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryLicensesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  tool?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : value === true || value === 'true'))
  @IsBoolean()
  hasAccess?: boolean;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
