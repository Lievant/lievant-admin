import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AUDIT_STATUSES } from '../equipment-audit.util';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const dateOnly = { message: 'La fecha debe tener el formato AAAA-MM-DD.' };
const LONG_TEXT = 5000;

export class CreateEquipmentAuditDto {
  @IsUUID()
  employeeId!: string;

  /** Usuario de la plataforma que audita; por omisión, la sesión. */
  @IsOptional()
  @IsUUID()
  technicianUserId?: string;

  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  auditDate?: string;
}

/**
 * Guardado parcial: el formulario manda solo el campo que cambió al perder el
 * foco. `null` limpia el valor. `status: 'completada'` equivale a completar.
 */
export class UpdateEquipmentAuditDto {
  @IsOptional()
  @Matches(DATE_ONLY, dateOnly)
  auditDate?: string;

  @IsOptional()
  @IsUUID()
  technicianUserId?: string;

  @IsOptional()
  @IsIn(['completada'])
  status?: 'completada';

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  generalNotes?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  surveyEquipmentScore?: number | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  surveyEquipmentNotes?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  surveyItServiceScore?: number | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  surveyItServiceNotes?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  surveyPlatformScore?: number | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  surveyPlatformNotes?: string | null;

  @IsOptional() @IsBoolean() maintenanceBlower?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceKeyboardCleaning?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceScreenCleaning?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceLogicalUnit?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceDriversUpdated?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceAntivirusRemoved?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceCacheCleaned?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceBitlockerActive?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceBrowserPasswordsCleared?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceOnedriveSynced?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceOnedriveBackup?: boolean | null;
  @IsOptional() @IsBoolean() maintenanceNoCRootFolders?: boolean | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  maintenanceSharedAccounts?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  maintenanceNotes?: string | null;
}

export class UpdateAuditEquipmentItemDto {
  @IsOptional() @IsBoolean() physicallyPresent?: boolean | null;
  @IsOptional() @IsBoolean() labelMarked?: boolean | null;

  /** Se normaliza a XX:XX:XX:XX:XX:XX en el servicio. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20)
  macAddress?: string | null;

  /** Se aplica al completar la auditoría, no al marcarlo. */
  @IsOptional() @IsBoolean() unassignedDuringAudit?: boolean;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  notPresentReason?: string | null;

  @IsOptional() @IsBoolean() simVerified?: boolean | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  simNotes?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  equipmentNotes?: string | null;
}

export class UpdateAuditLicenseItemDto {
  @IsOptional() @IsBoolean() licensePresent?: boolean | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(LONG_TEXT)
  missingNotes?: string | null;
}

export class QueryEquipmentAuditsDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() technicianId?: string;
  @IsOptional() @IsIn(AUDIT_STATUSES) status?: (typeof AUDIT_STATUSES)[number];
  @IsOptional() @Matches(DATE_ONLY, dateOnly) dateFrom?: string;
  @IsOptional() @Matches(DATE_ONLY, dateOnly) dateTo?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}
