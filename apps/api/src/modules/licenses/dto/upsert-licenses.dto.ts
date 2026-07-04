import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ToolAssignmentDto {
  @IsUUID()
  toolId!: string;

  @IsBoolean()
  hasAccess!: boolean;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpsertLicensesDto {
  @IsOptional()
  @IsString()
  activeDirectoryName?: string;

  @IsOptional()
  @IsString()
  responsiva?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolAssignmentDto)
  tools!: ToolAssignmentDto[];
}
