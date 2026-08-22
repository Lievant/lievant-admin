import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type {
  DocumentEntityKey,
  EntityFilter,
  StatusFilter,
} from '../document-status.service';

const ENTITY_KEYS: DocumentEntityKey[] = ['employees', 'clients', 'vendors'];
const FILTERS: EntityFilter[] = [
  'all',
  'complete',
  'incomplete',
  'sin_docs',
  'en_proceso',
  'no_required',
];
const STATUS: StatusFilter[] = ['all', 'active', 'inactive'];

export class QueryDocumentEntitiesDto {
  @IsIn(ENTITY_KEYS)
  entity!: DocumentEntityKey;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(FILTERS)
  filter?: EntityFilter;

  @IsOptional()
  @IsIn(STATUS)
  status?: StatusFilter;

  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryDocumentActivityDto {
  @IsIn(ENTITY_KEYS)
  entity!: DocumentEntityKey;

  /** Formato YYYY-MM-DD. */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** Formato YYYY-MM-DD, inclusivo. */
  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
