import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ASSIGNMENT_STATUSES } from '../constants/tools.constants';

export class CreateAssignmentDto {
  @IsUUID()
  toolId!: string;

  @IsUUID()
  employeeId!: string;

  /** Id del catálogo tools.assigners, no un usuario libre. */
  @IsOptional()
  @IsUUID()
  assignedById?: string;

  @IsOptional()
  @IsDateString()
  assignmentDate?: string;

  @IsOptional()
  @IsDateString()
  lastUsedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RevokeAssignmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateLastUsedDto {
  @IsDateString()
  date!: string;
}

/**
 * Acepta el usuario de la plataforma o el expediente del colaborador: el
 * EmployeePicker de la UI devuelve el expediente, y el catálogo referencia
 * auth.users, así que el servicio resuelve uno desde el otro por correo
 * corporativo. Tiene que venir al menos uno de los dos.
 */
export class CreateAssignerDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;
}

export class QueryCostReportDto {
  /** Filtra por assignment_date, que es la columna de alta de la asignación. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsUUID()
  toolId?: string;

  /** 'MXN' | 'USD'; omitido = ambas. */
  @IsOptional()
  @IsIn(['MXN', 'USD'])
  currency?: string;
}

export class QueryAssignmentsDto {
  @IsOptional()
  @IsUUID()
  toolId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  assignedById?: string;

  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES as unknown as string[])
  status?: string;

  /** Área del colaborador, tal como la devuelve GET /assignments/areas. */
  @IsOptional()
  @IsString()
  area?: string;

  /** Nombre del colaborador o de la herramienta. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Cursor de paginación: el assignment_code de la última fila leída. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  limit?: number;
}
