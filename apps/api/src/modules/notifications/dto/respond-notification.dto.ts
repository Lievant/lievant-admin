import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RespondNotificationDto {
  @IsIn(['aceptada', 'rechazada'])
  action!: 'aceptada' | 'rechazada';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
