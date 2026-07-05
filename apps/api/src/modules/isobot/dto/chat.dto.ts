import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ChatDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsNotEmpty()
  @IsString()
  message!: string;
}
