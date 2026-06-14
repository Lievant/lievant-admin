import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  vendor_id!: string;

  @IsOptional()
  @IsUUID()
  po_id?: string;

  @IsString()
  @IsNotEmpty()
  invoice_number!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsNumber()
  total!: number;

  @IsDateString()
  issue_date!: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
