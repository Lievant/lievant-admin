import { IsString, IsUUID } from 'class-validator';

export class EscalateTicketDto {
  @IsUUID()
  escalateTo!: string;

  @IsString()
  reason!: string;
}
