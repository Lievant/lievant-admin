import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEquipmentDto {
  @IsNotEmpty()
  @IsString()
  equipmentType!: string;

  @IsOptional()
  @IsString()
  legacyId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  operatingSystem?: string;

  @IsOptional()
  @IsString()
  adName?: string;

  @IsOptional()
  @IsString()
  specifications?: string;

  @IsOptional()
  @IsUUID()
  assignedToEmployeeId?: string;

  @IsOptional()
  @IsDateString()
  assignmentDate?: string;

  @IsOptional()
  @IsString()
  responsiva?: string;

  @IsOptional()
  @IsBoolean()
  chargerIncluded?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  // null borra el valor (el formulario lo manda así al vaciar el campo).
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseValue?: number | null;

  @IsOptional()
  @IsString()
  notes?: string;

  // ── Información financiera (todos opcionales; null desvincula/borra) ──────
  @IsOptional()
  @IsUUID()
  financialProviderId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNumber?: string | null;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string | null;

  // ── Garantía (todos opcionales) ─────────────────────────────────────────
  // La factura no va aquí: se sube por su propio endpoint multipart.
  @IsOptional()
  @IsUUID()
  warrantyProviderId?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiryDate?: string;

  @IsOptional()
  @IsString()
  warrantyPurchaseOrder?: string;

  @IsOptional()
  @IsString()
  warrantyNotes?: string;
}
