import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendeeDto } from './create-booking.dto';

export class UpdateBookingDto {
  /** Mover la reserva a otra sala de la misma oficina. */
  @IsOptional()
  @IsUUID()
  room_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsISO8601()
  end_time?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendeeDto)
  attendees?: AttendeeDto[];
}
