import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(['P1', 'P2', 'P3', 'P4'])
  priority?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsIn(['resuelto', 'no_se_puede', 'cancelado'])
  problemStatus?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  estimatedDelivery?: string;

  @IsOptional()
  @IsIn(['pendiente', 'confirmado', 'rechazado'])
  collaboratorConfirmation?: string;
}
