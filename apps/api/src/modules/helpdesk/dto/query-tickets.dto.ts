import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** Valor reservado de `assignedTo` para los tickets sin persona asignada. */
export const UNASSIGNED_FILTER = 'sin_asignar';
const UUID_OR_UNASSIGNED = /^(sin_asignar|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export class QueryTicketsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  area?: string;

  /** UUID de la persona asignada (helpdesk.ticket_assignees) o `sin_asignar`. */
  @IsOptional()
  @Matches(UUID_OR_UNASSIGNED, { message: 'assignedTo debe ser un UUID o sin_asignar' })
  assignedTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsIn(['ok', 'warning', 'overdue'])
  slaStatus?: 'ok' | 'warning' | 'overdue';
}
