import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// ── Maestro de tarjetas ──────────────────────────────────────────────────────

export class CreateCreditCardDto {
  @Matches(/^\d{4}$/, { message: 'lastFour deben ser exactamente 4 dígitos.' })
  @Length(4, 4)
  lastFour!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;

  @IsUUID()
  holderEmployeeId!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCreditCardDto {
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'lastFour deben ser exactamente 4 dígitos.' })
  lastFour?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;

  @IsOptional()
  @IsUUID()
  holderEmployeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryCreditCardsDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

// ── Reportes ─────────────────────────────────────────────────────────────────

export class CardExpenseLineDto {
  @IsDateString()
  lineDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  collaborator?: string;

  @IsOptional()
  @IsString()
  motive?: string;

  @IsString()
  @MaxLength(300)
  vendor!: string;

  @IsOptional()
  @IsUUID()
  conceptId?: string;

  @IsOptional()
  @IsUUID()
  expenseTypeId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tip?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extras?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateCardReportDto {
  @IsUUID()
  creditCardId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardExpenseLineDto)
  lines?: CardExpenseLineDto[];
}

/** Las líneas se reemplazan completas, igual que en reembolsos. */
export class UpdateCardReportDto extends CreateCardReportDto {}

export class ProcessCardReportDto {
  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class QueryCardReportsDto {
  @IsOptional()
  @IsIn(['draft', 'submitted', 'processed'])
  status?: string;

  @IsOptional()
  @IsUUID()
  creditCardId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
