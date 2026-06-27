import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTicketDto {
  @IsOptional()
  @IsBoolean()
  openedByTd?: boolean;

  @IsOptional()
  @IsString()
  openedOnBehalfOf?: string;

  @IsOptional()
  @IsString()
  behalfReason?: string;

  @IsString()
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcategory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipmentId?: string;

  @IsString()
  description!: string;

  @IsIn(['alto', 'medio', 'bajo'])
  impact!: string;

  @IsOptional()
  @IsString()
  estimatedDelivery?: string;
}
