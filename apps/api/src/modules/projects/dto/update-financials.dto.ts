import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateFinancialsDto {
  @IsOptional() @IsIn(['monthly_fee', 'one_time', 'milestone', 'variable']) billingType?: string;
  @IsOptional() @IsIn(['MXN', 'COP', 'USD']) currency?: string;
  @IsOptional() @IsString() totalValue?: string;
  @IsOptional() @IsString() monthlyFee?: string;
  @IsOptional() @IsString() overheadPercentage?: string;
  @IsOptional() @IsBoolean() hasCommission?: boolean;
  @IsOptional() @IsString() commissionPercentage?: string;
  @IsOptional() @IsUUID() commissionEmployeeId?: string;
  @IsOptional() @IsNumber() billingDay?: number;
  @IsOptional() @IsString() billingNotes?: string;
}
