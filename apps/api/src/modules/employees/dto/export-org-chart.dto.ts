import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrgChartQueryDto } from './org-chart-query.dto';

export const EXPORT_VIEWS = ['hierarchy', 'levels'] as const;
export const EXPORT_PAPERS = ['carta', 'a3'] as const;

/** Lo que se va a exportar: la vista, el papel y los mismos filtros del organigrama. */
export class ExportOrgChartDto extends OrgChartQueryDto {
  @IsIn(EXPORT_VIEWS)
  view!: (typeof EXPORT_VIEWS)[number];

  @IsIn(EXPORT_PAPERS)
  paper!: (typeof EXPORT_PAPERS)[number];

  /** Informativos (los calcula el navegador al generar): quedan en la bitácora. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  pages?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  employees?: number;
}
