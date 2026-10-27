import { IsOptional, IsString, MaxLength } from 'class-validator';

export class OrgChartQueryDto {
  /**
   * Filtro opcional por ubicación del expediente. El expediente no tiene campo
   * de país (solo `location`), así que el filtro opera sobre ese valor.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}
