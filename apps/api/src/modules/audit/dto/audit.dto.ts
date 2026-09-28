import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const SECURITY_EVENT_TYPES = [
  'login_success',
  'login_failed',
  'logout',
  'password_reveal',
  'access_denied',
  'permission_escalation',
  'user_deactivated',
  'user_created',
  'password_changed',
  'data_export',
  'bulk_operation',
] as const;

export const SEVERITIES = ['info', 'warning', 'critical'] as const;

export const ACTIVITY_ACTIONS = [
  'create',
  'update',
  'delete',
  'restore',
  'approve',
  'reject',
  'revoke',
  'export',
  'upload',
  'download',
] as const;

/** Payloads internos: los arma el servidor, nunca llegan del cliente. */
export interface SecurityEventInput {
  eventType: string;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  module?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  severity?: string;
}

export interface UserActivityInput {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  department?: string | null;
  action: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface PlatformErrorInput {
  errorCode?: string | null;
  message: string;
  stackTrace?: string | null;
  module?: string | null;
  endpoint?: string | null;
  httpMethod?: string | null;
  httpStatus?: number | null;
  userId?: string | null;
  userEmail?: string | null;
  requestBody?: Record<string, unknown> | null;
  durationMs?: number | null;
}

export interface UserSessionInput {
  userId: string;
  userEmail?: string | null;
  department?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ── Consultas ───────────────────────────────────────────────────────────────

class BaseLogQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Cursor: el created_at ISO de la última fila leída. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class QuerySecurityDto extends BaseLogQueryDto {
  @IsOptional()
  @IsIn(SECURITY_EVENT_TYPES as unknown as string[])
  eventType?: string;

  @IsOptional()
  @IsIn(SEVERITIES as unknown as string[])
  severity?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class QueryActivityDto extends BaseLogQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsIn(ACTIVITY_ACTIONS as unknown as string[])
  action?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class QueryErrorsDto extends BaseLogQueryDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  httpStatus?: number;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  resolved?: boolean;
}

export class QuerySessionsDto extends BaseLogQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class QueryAnalyticsDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class UpdateModuleConfigDto {
  @IsOptional()
  @IsBoolean()
  auditEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  logReads?: boolean;

  @IsOptional()
  @IsBoolean()
  logWrites?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;
}
