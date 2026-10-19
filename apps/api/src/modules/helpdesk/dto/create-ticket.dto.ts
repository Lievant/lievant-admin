import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

  /**
   * Expediente (employees.employee_records.id) de la persona en cuyo nombre se
   * abre el ticket. Solo lo acepta el personal de TD; esa persona queda como
   * solicitante.
   */
  @IsOptional()
  @IsUUID()
  onBehalfOfEmployeeId?: string;

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

  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}
