import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsIn(['abierto', 'en_atencion', 'en_revision', 'resuelto', 'cerrado', 'cancelado'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
