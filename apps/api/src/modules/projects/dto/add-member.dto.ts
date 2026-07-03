import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsUUID() employeeId!: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() estimatedHoursMonthly?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
