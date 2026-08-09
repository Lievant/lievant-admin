import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { VendorStatus } from '../entities/vendor.entity';

export class QueryVendorsDto {
  /** Estado documental calculado; filtra sobre el CASE del SELECT. */
  @IsOptional()
  @IsIn(['complete', 'incomplete', 'no_required'])
  docStatus?: 'complete' | 'incomplete' | 'no_required';

  /** Cursor base64url con { createdAt, id } de la última fila de la página previa. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

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
