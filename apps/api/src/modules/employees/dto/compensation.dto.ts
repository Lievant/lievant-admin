import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCompensationDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyGrossSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyGrossSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  servicePayment?: number;

  @IsOptional()
  @IsDateString()
  lastSalaryChange?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  remoteWorkAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  groceryVouchers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gasVouchers?: number;

  @IsOptional()
  @IsString()
  healthInsurance?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  phoneAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  punctualityBonus?: number;

  @IsOptional()
  @IsString()
  otherBenefits?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalGross?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  netEstimate?: number;
}
