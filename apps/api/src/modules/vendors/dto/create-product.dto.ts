import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ProductType } from '../entities/vendor-product.entity';

export class CreateProductDto {
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ProductType)
  type!: ProductType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  unit_price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
