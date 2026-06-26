import { IsString, MaxLength } from 'class-validator';

export class UploadEmployeeDocumentDto {
  @IsString()
  @MaxLength(50)
  type!: string;

  @IsString()
  @MaxLength(255)
  name!: string;
}
