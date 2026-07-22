import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { ClientStatus } from '../constants/client-status.constant';

export enum ClientCreationType {
  GROUP = 'group',
  DIRECT = 'direct',
}

export class CreateClientCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  rfc?: string;
}

export class CreateClientBrandDto {
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateClientDto {
  @IsEnum(ClientCreationType)
  type!: ClientCreationType;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested()
  @Type(() => CreateClientCompanyDto)
  company!: CreateClientCompanyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientBrandDto)
  brand?: CreateClientBrandDto;
}
