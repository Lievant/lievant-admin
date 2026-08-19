import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UploadVendorDocumentDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

/** Paso 1: el frontend pide la URL prefirmada antes de subir a S3. */
export class PresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;
}

/** Paso 3: el frontend avisa que el objeto ya está en S3 y se registra. */
export class RegisterVendorDocumentDto extends UploadVendorDocumentDto {
  @IsString()
  @IsNotEmpty()
  s3Key!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;
}
