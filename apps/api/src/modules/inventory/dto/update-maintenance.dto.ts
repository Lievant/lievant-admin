import { PartialType } from '@nestjs/mapped-types';
import { CreateMaintenanceDto } from './create-maintenance.dto';

/**
 * Todos los campos opcionales: una edición puede tocar solo la fecha, el tipo,
 * el técnico o las observaciones. Las mismas reglas (fecha no futura, tipo válido,
 * técnico activo) siguen aplicando sobre los campos que sí lleguen.
 */
export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {}
