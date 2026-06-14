import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class LineItemDto {
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unit_price!: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  vendor_id!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  line_items!: LineItemDto[];
}
