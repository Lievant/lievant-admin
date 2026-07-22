import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { IsNotFutureDate } from '../validators/employee-validators';

export class UpdatePersonalDataDto {
  @IsOptional()
  @IsString()
  @Length(13, 13)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'rfc debe contener únicamente letras y números' })
  rfc?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'imssNumber debe contener únicamente dígitos' })
  imssNumber?: string;

  @IsOptional()
  @IsString()
  @Length(18, 18)
  curp?: string;

  @IsOptional()
  @IsNotFutureDate()
  birthDate?: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  extNumber?: string;

  @IsOptional()
  @IsString()
  intNumber?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  mainTransport?: string;

  @IsOptional()
  @IsString()
  commuteTime?: string;
}
