import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Filtros opcionales del organigrama, combinables con AND. El valor especial
 * `__none__` filtra los empleados con ese campo vacío ("Sin División", etc.).
 */
export class OrgChartQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  division?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  /**
   * Filtro de país que ya existía: el expediente no tiene campo de país (solo
   * `location`), así que opera sobre ese valor.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}
