import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TOOL_CONTRACT_STATUSES } from '../constants/tools.constants';

export class QueryToolsDto {
  @IsOptional()
  @IsString()
  search?: string;

  // La categoría se valida contra catalogs.tool_categories, no contra una lista
  // fija: el catálogo es editable desde /admin/catalogos.
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(TOOL_CONTRACT_STATUSES as unknown as string[])
  contractStatus?: string;

  /**
   * Herramientas que renuevan dentro de los próximos N días. Sirve al filtro
   * "Próximas renovaciones" sin que el frontend tenga que calcular el rango.
   */
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  renewingWithinDays?: number;
}
