import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { HEADCOUNT_COLUMN_KEYS } from '../constants/headcount-columns.constant';

// Acepta tanto `?empresa=A&empresa=B` como `?empresa=A,B`.
function toList({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const list = raw
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export class GetHeadcountDto {
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  empresa?: string[];

  /** 'true' (default) → activos, 'false' → inactivos, 'todos' → sin filtro. */
  @IsOptional()
  @IsIn(['true', 'false', 'todos'])
  activo?: 'true' | 'false' | 'todos';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  division?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ubicacion?: string;

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(HEADCOUNT_COLUMN_KEYS, { each: true })
  columns?: string[];

  @IsOptional()
  @IsIn(['json', 'xlsx'])
  format?: 'json' | 'xlsx';
}
