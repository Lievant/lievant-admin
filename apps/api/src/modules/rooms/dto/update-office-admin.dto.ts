import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AdminScope } from '../entities/office-admin.entity';

export class UpdateOfficeAdminDto {
  @IsUUID()
  user_id!: string;

  @IsOptional()
  @IsUUID()
  office_id?: string;

  @IsEnum(AdminScope)
  scope!: AdminScope;
}
