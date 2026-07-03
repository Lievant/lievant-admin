import { IsString } from 'class-validator';

export class UploadProjectDocumentDto {
  @IsString() type!: string;
  @IsString() name!: string;
}
