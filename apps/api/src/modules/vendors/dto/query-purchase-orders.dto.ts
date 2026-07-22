import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { POStatus } from '../entities/purchase-order.entity';

export class QueryPurchaseOrdersDto {
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsOptional()
  @IsEnum(POStatus)
  status?: POStatus;
}
