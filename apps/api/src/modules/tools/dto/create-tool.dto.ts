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
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TOOL_BILLING_PERIODS,
  TOOL_CATEGORIES,
  TOOL_CONTRACT_STATUSES,
  TOOL_COST_CENTERS,
  TOOL_CURRENCIES,
} from '../constants/tools.constants';

export class CreateToolDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(TOOL_CATEGORIES as unknown as string[])
  category!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  provider!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  url?: string;

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
  @IsIn(TOOL_COST_CENTERS as unknown as string[])
  costCenter?: string;

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
