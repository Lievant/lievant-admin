import { IsBoolean, IsDateString, IsEmail, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateFinancialDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentDays?: number;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsString()
  billingContact?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  satPaymentMethod?: string;

  @IsOptional()
  @IsString()
  satPaymentForm?: string;

  @IsOptional()
  @IsString()
  satCfdiUse?: string;

  @IsOptional()
  @IsString()
  satTaxRegime?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankClabe?: string;

  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}
