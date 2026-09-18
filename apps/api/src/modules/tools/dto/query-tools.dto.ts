import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  TOOL_CATEGORIES,
  TOOL_CONTRACT_STATUSES,
  TOOL_COST_CENTERS,
} from '../constants/tools.constants';

export class QueryToolsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TOOL_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsIn(TOOL_CONTRACT_STATUSES as unknown as string[])
  contractStatus?: string;

  @IsOptional()
  @IsIn(TOOL_COST_CENTERS as unknown as string[])
  costCenter?: string;

  /**
   * Herramientas que renuevan dentro de los próximos N días. Sirve al filtro
   * "Próximas renovaciones" sin que el frontend tenga que calcular el rango.
   */
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? undefined : Number(value)))
  renewingWithinDays?: number;
}
