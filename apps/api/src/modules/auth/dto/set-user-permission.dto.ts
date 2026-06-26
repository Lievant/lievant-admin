import { IsBoolean, IsUUID } from 'class-validator';

export class SetUserPermissionDto {
  @IsUUID()
  permissionId!: string;

  @IsBoolean()
  granted!: boolean;
}
