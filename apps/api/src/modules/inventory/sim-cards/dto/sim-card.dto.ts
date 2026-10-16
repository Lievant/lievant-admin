import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const SIM_STATUSES = ['activa', 'suspendida', 'cancelada'] as const;
export const SIM_DEVICE_TYPES = ['smartphone', 'tablet', 'modem', 'otro'] as const;
export const SIM_CURRENCIES = ['MXN', 'USD'] as const;
export const SIM_EXPIRY_FILTERS = ['por_vencer', 'vencida'] as const;
export const SIM_UNASSIGN_SCOPES = ['employee', 'equipment', 'all'] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Fecha de calendario (YYYY-MM-DD) y real: rechaza 2026-02-31. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const dateOnly = { message: 'La fecha debe tener el formato AAAA-MM-DD.' };

// ── Planes ───────────────────────────────────────────────────────────────────

export class CreateSimPlanDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'El nombre del plan es obligatorio.' })
  @MaxLength(150)
  name!: string;

  @IsUUID()
  vendorId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  monthlyCost!: number;

  @IsOptional()
  @IsIn(SIM_CURRENCIES)
  currency?: (typeof SIM_CURRENCIES)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSimPlanDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'El nombre del plan es obligatorio.' })
  @MaxLength(150)
  name?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  vendorId?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  monthlyCost?: number;

  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(SIM_CURRENCIES)
  currency?: (typeof SIM_CURRENCIES)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

// ── Líneas ───────────────────────────────────────────────────────────────────

export class CreateSimCardDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'El número de la línea es obligatorio.' })
  @MaxLength(30)
  phoneNumber!: string;

  @IsUUID()
  planId!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  iccid?: string | null;

  /** Costo propio de la línea; si falta se usa el del plan. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  monthlyCost?: number | null;

  @IsOptional()
  @IsIn(SIM_CURRENCIES)
  currency?: (typeof SIM_CURRENCIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  termMonths?: number | null;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  @IsISO8601({ strict: true })
  contractEndDate?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  @IsISO8601({ strict: true })
  activationDate?: string | null;

  @IsOptional()
  @IsIn(SIM_STATUSES)
  status?: (typeof SIM_STATUSES)[number];

  @IsOptional()
  @IsIn(SIM_DEVICE_TYPES)
  deviceType?: (typeof SIM_DEVICE_TYPES)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  // Asignación inicial opcional: el alta con persona/equipo escribe su historial.
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  @IsISO8601({ strict: true })
  assignedDate?: string;
}

/**
 * Edición de los datos de la línea. `employeeId`, `equipmentId` y `assignedDate`
 * no están aquí a propósito: con `forbidNonWhitelisted` el API los rechaza y la
 * asignación solo cambia por `assign` / `unassign`, que son los que escriben el
 * historial.
 */
export class UpdateSimCardDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'El número de la línea es obligatorio.' })
  @MaxLength(30)
  phoneNumber?: string;

  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID()
  planId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  iccid?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  monthlyCost?: number | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(SIM_CURRENCIES)
  currency?: (typeof SIM_CURRENCIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  termMonths?: number | null;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  @IsISO8601({ strict: true })
  contractEndDate?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  @IsISO8601({ strict: true })
  activationDate?: string | null;

  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(SIM_STATUSES)
  status?: (typeof SIM_STATUSES)[number];

  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(SIM_DEVICE_TYPES)
  deviceType?: (typeof SIM_DEVICE_TYPES)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class AssignSimCardDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  equipmentId?: string;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  @IsISO8601({ strict: true })
  assignedDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UnassignSimCardDto {
  /** Qué se quita: la persona, el equipo o ambos (por omisión, ambos). */
  @IsOptional()
  @IsIn(SIM_UNASSIGN_SCOPES)
  scope?: (typeof SIM_UNASSIGN_SCOPES)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class QuerySimCardsDto {
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
  @IsIn(SIM_STATUSES)
  status?: (typeof SIM_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @IsIn(SIM_EXPIRY_FILTERS)
  expiry?: (typeof SIM_EXPIRY_FILTERS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
