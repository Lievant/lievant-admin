import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { RoomType } from '../entities/room.entity';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class QueryAvailabilityDto {
  @IsUUID()
  @IsNotEmpty()
  office_id!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'start_time debe tener formato HH:MM' })
  start_time!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(12)
  duration_hours!: number;

  @IsOptional()
  @IsEnum(RoomType)
  room_type?: RoomType;
}
