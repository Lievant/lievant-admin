import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { VendorStatus } from '../entities/vendor.entity';

export class QueryVendorsDto {
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
