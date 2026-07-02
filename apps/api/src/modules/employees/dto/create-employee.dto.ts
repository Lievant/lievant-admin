import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { EmployeeStatus } from '../constants/employee-status.constant';
import { Modality } from '../constants/modality.constant';
import { IsCorporateEmailDomain, IsNotFutureDate } from '../validators/employee-validators';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  codNom?: string;

  @IsString()
  @IsNotEmpty()
  companyCode!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsOptional()
  @IsString()
  emailSignature?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @IsOptional()
  @IsString()
  contractSchema?: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  directReportTo?: string;

  @IsOptional()
  @IsUUID()
  directReportToId?: string;

  @IsOptional()
  @IsCorporateEmailDomain()
  corporateEmail?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsNotFutureDate()
  seniorityDate?: string;

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsOptional()
  @IsString()
  schedule?: string;

  @IsOptional()
  @IsString()
  lunchTime?: string;

  @IsOptional()
  @IsString()
  studies?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsUUID()
  authUserId?: string;
}
