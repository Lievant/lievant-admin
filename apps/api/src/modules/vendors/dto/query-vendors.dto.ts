import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { VendorStatus } from '../entities/vendor.entity';

export class QueryVendorsDto {
  /** Estado documental calculado; filtra sobre el CASE del SELECT. */
  @IsOptional()
  @IsIn(['complete', 'incomplete', 'no_required'])
  docStatus?: 'complete' | 'incomplete' | 'no_required';

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
