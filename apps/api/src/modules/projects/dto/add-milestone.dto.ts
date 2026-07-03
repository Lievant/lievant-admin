import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AddMilestoneDto {
  @IsString() name!: string;
  @IsString() amount!: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
}
