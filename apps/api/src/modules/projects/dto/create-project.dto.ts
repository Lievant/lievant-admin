import { IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BusinessUnitEntryDto {
  @IsString() businessUnit!: string;
  @IsString() percentage!: string;
}

export class CreateProjectDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsIn(['one_time', 'recurring', 'variable']) projectType!: string;
  @IsOptional() @IsIn(['draft', 'active', 'paused', 'completed', 'cancelled']) status?: string;
  @IsOptional() @IsUUID() clientRecordId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsString() primaryBusinessUnit?: string;
  @IsOptional() @IsUUID() projectManagerId?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() pmCode?: string;
  @IsOptional() @IsString() corProjectId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BusinessUnitEntryDto)
  businessUnits?: BusinessUnitEntryDto[];
}
