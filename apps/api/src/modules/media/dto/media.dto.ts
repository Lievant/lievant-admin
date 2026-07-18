import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

// --- Cuentas ---

export class CreateAdAccountDto {
  @IsUUID()
  platformId!: string;

  @IsOptional()
  @IsUUID()
  credentialId?: string;

  @IsOptional()
  @IsUUID()
  clientRecordId?: string;

  @IsString()
  @Length(1, 200)
  nativeAccountId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  nativeAccountName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;
}

export class UpdateAdAccountDto {
  @IsOptional()
  @IsUUID()
  credentialId?: string;

  @IsOptional()
  @IsUUID()
  clientRecordId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  nativeAccountName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;
}

export class QueryAccountsDto {
  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsUUID()
  clientRecordId?: string;

  @IsOptional()
  @IsIn(['green', 'yellow', 'red', 'gray'])
  status?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

// --- Presupuestos ---

export class UpsertBudgetDto {
  @IsUUID()
  adAccountId!: string;

  @IsDateString()
  budgetMonth!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountMxn?: number;

  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['manual', 'excel', 'api'])
  source?: string;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryBudgetsDto {
  @IsOptional()
  @IsUUID()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  month?: string;
}

// --- Alertas ---

export class QueryAlertsDto {
  @IsOptional()
  @IsIn(['active', 'acknowledged', 'resolved'])
  status?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsUUID()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  alertType?: string;
}

// --- Bitácora ---

export class QueryAuditLogDto {
  @IsOptional()
  @IsUUID()
  adAccountId?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

// --- Gasto ---

export class QuerySpendDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  days?: number;

  @IsOptional()
  @IsString()
  month?: string;
}
