import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '../constants/document-status.constant';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  filePath!: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
