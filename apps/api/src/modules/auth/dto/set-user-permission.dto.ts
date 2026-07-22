import { IsBoolean, IsUUID, ValidateIf } from 'class-validator';

export class SetUserPermissionDto {
  @IsUUID()
  permissionId!: string;

  @ValidateIf((o: SetUserPermissionDto) => o.granted !== null)
  @IsBoolean()
  granted!: boolean | null;
}
