import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InvoiceStatus } from '../entities/invoice.entity';

export class QueryInvoicesDto {
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
