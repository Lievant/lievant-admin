import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { SURVEY_RATINGS, type SurveyRating } from '../entities/ticket-survey.entity';

export const SURVEY_COMMENT_MAX = 1000;

export class CreateTicketSurveyDto {
  @IsIn(SURVEY_RATINGS, { message: 'La calificación debe ser feliz, normal, triste o enojado.' })
  rating!: SurveyRating;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(SURVEY_COMMENT_MAX, { message: `Las observaciones no pueden pasar de ${SURVEY_COMMENT_MAX} caracteres.` })
  comment?: string | null;
}
