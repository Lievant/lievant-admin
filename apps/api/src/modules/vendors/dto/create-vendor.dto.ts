import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { VendorStatus } from '../entities/vendor.entity';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  trade_name?: string;

  @IsString()
  @Length(12, 13)
  rfc!: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @IsOptional()
  @IsInt()
  payment_terms_days?: number;

  @IsOptional()
  @IsString()
  clabe?: string;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  bank_account?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
