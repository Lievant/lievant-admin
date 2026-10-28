import { IsOptional, IsUUID, Matches } from 'class-validator';

const PERIOD = /^[0-9]{4}-S[12]$/;
const MSG = { message: 'El periodo debe tener formato AAAA-S1 o AAAA-S2' };

export class PeriodQueryDto {
  @IsOptional()
  @Matches(PERIOD, MSG)
  period?: string;
}

export class AssignDto {
  @Matches(PERIOD, MSG)
  period!: string;
}

/** `null` desvincula el puesto. */
export class SetPositionDto {
  @IsOptional()
  @IsUUID()
  jobPositionId?: string | null;
}
