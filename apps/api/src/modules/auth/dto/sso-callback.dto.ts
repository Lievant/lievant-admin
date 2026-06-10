import { IsNotEmpty, IsString } from 'class-validator';

export class SsoCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}
