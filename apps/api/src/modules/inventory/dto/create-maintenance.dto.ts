import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Rechaza fechas futuras (RN-3). Se compara contra `Date.now()`, no contra
 * medianoche local: un mantenimiento se registra después de hacerlo, así que su
 * fecha nunca es futura. Mismo criterio que el validador de RRHH.
 */
export function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: validationOptions ?? {},
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) return false;
          return date.getTime() <= Date.now();
        },
        defaultMessage(): string {
          return `${propertyName} no puede ser una fecha futura`;
        },
      },
    });
  };
}

/** Tipos permitidos. Restringido aquí porque el ValidationPipe global no deja pasar otros. */
export const MAINTENANCE_TYPES = ['Preventivo', 'Correctivo'] as const;

export class CreateMaintenanceDto {
  // 'YYYY-MM-DD'. No puede ser futura (RN-3).
  @IsNotEmpty()
  @IsString()
  @IsNotFutureDate()
  maintenanceDate!: string;

  // Solo el preventivo reinicia el reloj de 6 meses (RN-1). Si no se envía, el
  // servicio asume 'Preventivo' (default de la columna, spec §5).
  @IsOptional()
  @IsIn(MAINTENANCE_TYPES)
  maintenanceType?: (typeof MAINTENANCE_TYPES)[number];

  // El técnico debe existir y estar activo al registrar (RN-4); el servicio lo valida.
  @IsNotEmpty()
  @IsUUID()
  technicianId!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
