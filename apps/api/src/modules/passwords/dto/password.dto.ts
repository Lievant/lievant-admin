import { PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const PASSWORD_STATUS_FILTERS = ['activa', 'por_vencer', 'vencida', 'revocada'] as const;
export type PasswordStatusFilter = (typeof PASSWORD_STATUS_FILTERS)[number];

export class QueryPasswordsDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @IsOptional()
  @IsIn(PASSWORD_STATUS_FILTERS)
  status?: PasswordStatusFilter;
}

export class CreateAccountPasswordDto {
  @IsUUID()
  applicationId!: string;

  @IsUUID()
  employeeId!: string;

  // Cualquier dominio: las cuentas de clientes y plataformas no son @lievant.com.
  @IsEmail({}, { message: 'El usuario debe ser un correo válido' })
  @MaxLength(500)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  password!: string;

  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  // null explícito borra el vencimiento al editar.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  expiryDate?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

/** Al editar, la contraseña es opcional: vacía significa "no cambiarla". */
export class UpdateAccountPasswordDto extends PartialType(CreateAccountPasswordDto) {}

export class RevealQueryDto {
  @IsOptional()
  @IsIn(['ver', 'copiar'])
  action?: 'ver' | 'copiar';
}

export class CreatePasswordApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdatePasswordApplicationDto extends PartialType(CreatePasswordApplicationDto) {}
