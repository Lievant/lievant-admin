import { IsEnum } from 'class-validator';
import { POStatus } from '../entities/purchase-order.entity';

export class UpdatePoStatusDto {
  @IsEnum(POStatus)
  status!: POStatus;
}
