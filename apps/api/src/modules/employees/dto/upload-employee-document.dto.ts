import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class UploadEmployeeDocumentDto {
  @IsString()
  @MaxLength(50)
  type!: string;

  @IsString()
  @MaxLength(255)
  name!: string;
}

/** Paso 1: el frontend pide la URL prefirmada antes de subir a S3. */
export class PresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
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
export class RegisterEmployeeDocumentDto extends UploadEmployeeDocumentDto {
  @IsString()
  @IsNotEmpty()
  s3Key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;
}
