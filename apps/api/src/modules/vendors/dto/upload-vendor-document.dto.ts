import { IsNotEmpty, IsString } from 'class-validator';

export class UploadVendorDocumentDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}
