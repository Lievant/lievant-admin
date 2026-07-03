import { IsOptional, IsString } from 'class-validator';

export class QueryProjectsDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() projectType?: string;
  @IsOptional() @IsString() businessUnit?: string;
  @IsOptional() @IsString() clientRecordId?: string;
  @IsOptional() @IsString() projectManagerId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsString() limit?: string;
}
