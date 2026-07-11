import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVacationRequestDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  substituteEmployeeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
