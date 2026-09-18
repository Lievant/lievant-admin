import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TOOL_BILLING_PERIODS,
  TOOL_CONTRACT_STATUSES,
  TOOL_CURRENCIES,
} from '../constants/tools.constants';

export class CreateToolDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  // Se valida contra catalogs.tool_categories en el servicio: la lista es
  // editable desde /admin/catalogos y un @IsIn la volvería a congelar aquí.
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  category!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  provider!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsIn(TOOL_CURRENCIES as unknown as string[])
  currency?: string;

  @IsIn(TOOL_BILLING_PERIODS as unknown as string[])
  billingPeriod!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  billingDay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  commercialContact?: string;

  @IsOptional()
  @IsDateString()
  nextRenewalDate?: string;

  @IsOptional()
  @IsIn(TOOL_CONTRACT_STATUSES as unknown as string[])
  contractStatus?: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
