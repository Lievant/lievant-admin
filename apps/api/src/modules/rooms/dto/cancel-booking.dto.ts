import { IsBoolean, IsOptional } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsBoolean()
  cancel_series?: boolean;
}
