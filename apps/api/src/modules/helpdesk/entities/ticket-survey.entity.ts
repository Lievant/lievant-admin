import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const SURVEY_RATINGS = ['feliz', 'normal', 'triste', 'enojado'] as const;
export type SurveyRating = (typeof SURVEY_RATINGS)[number];

/** Encuesta de satisfacción de un ticket cerrado. Una por ticket; solo inserción. */
@Entity({ name: 'ticket_surveys', schema: 'helpdesk' })
export class TicketSurvey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid', unique: true })
  ticketId!: string;

  @Column({ type: 'varchar', length: 10 })
  rating!: SurveyRating;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  comment!: string | null;

  @Column({ name: 'answered_by', type: 'uuid', nullable: true })
  answeredBy!: string | null;

  @Column({ name: 'answered_by_name', type: 'varchar', length: 200 })
  answeredByName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
