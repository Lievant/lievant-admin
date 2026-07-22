import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { RoomType } from '../entities/room.entity';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateRoomDto {
  @IsUUID()
  office_id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(RoomType)
  type!: RoomType;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'open_time debe tener formato HH:MM' })
  open_time?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'close_time debe tener formato HH:MM' })
  close_time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  max_booking_hours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  requires_approval_over_hours?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
