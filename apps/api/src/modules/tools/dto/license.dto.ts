import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { LICENSE_STATUSES, TOOL_CURRENCIES } from '../constants/tools.constants';

export class CreateLicenseDto {
  @IsUUID()
  toolId!: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  employeeUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  licenseType?: string;

  /** Si no se manda, se hereda del área del colaborador. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessUnit?: string;

  /** Si no se manda, se hereda del costo unitario de la herramienta. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsIn(TOOL_CURRENCIES as unknown as string[])
  currency?: string;

  @IsOptional()
  @IsDateString()
  assignedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLicenseDto extends PartialType(CreateLicenseDto) {
  @IsOptional()
  @IsIn(LICENSE_STATUSES as unknown as string[])
  status?: string;
}

export class RevokeLicenseDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryLicensesDto {
  @IsOptional()
  @IsUUID()
  toolId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  businessUnit?: string;

  @IsOptional()
  @IsIn(LICENSE_STATUSES as unknown as string[])
  status?: string;

  @IsOptional()
  @IsIn(TOOL_CURRENCIES as unknown as string[])
  currency?: string;

  /** Nombre del colaborador o de la herramienta. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  limit?: number;
}
