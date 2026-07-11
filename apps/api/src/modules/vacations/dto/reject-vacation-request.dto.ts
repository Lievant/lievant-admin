import { IsString, MinLength } from 'class-validator';

export class RejectVacationRequestDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
