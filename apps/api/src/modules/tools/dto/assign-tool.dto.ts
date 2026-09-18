import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class AssignToolDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;

  /** Costo distinto al unitario del catálogo (plan diferente, descuento). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCostOverride?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RevokeAssignmentDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
