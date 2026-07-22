import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignEmployeeDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsDateString()
  assignmentDate?: string;

  @IsOptional()
  @IsString()
  responsiva?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
