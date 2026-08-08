import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExpenseLineDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsDateString()
  lineDate!: string;

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
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateExpenseReportDto {
  @IsOptional()
  @IsUUID()
  authorizerEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsString()
  motive!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  lines?: ExpenseLineDto[];
}

/**
 * Las líneas se reemplazan completas al guardar: la tabla se edita en línea y
 * mandar un diff por fila obligaría al cliente a llevar el estado de altas,
 * bajas y cambios.
 */
export class UpdateExpenseReportDto extends CreateExpenseReportDto {}

export class AuthorizeExpenseReportDto {
  @IsIn(['authorized', 'rejected'])
  action!: 'authorized' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ProcessExpenseReportDto {
  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class QueryExpenseReportsDto {
  @IsOptional()
  @IsIn(['draft', 'submitted', 'authorized', 'rejected', 'processed'])
  status?: string;

  @IsOptional()
  @IsString()
  requester?: string;

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
