import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tickets', schema: 'helpdesk' })
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'display_id', type: 'varchar', length: 20, unique: true })
  displayId!: string;

  @Column({ name: 'requester_id', type: 'uuid', nullable: true })
  requesterId!: string | null;

  @Column({ name: 'requester_name', type: 'varchar', length: 200 })
  requesterName!: string;

  @Column({ name: 'requester_area', type: 'varchar', length: 100, nullable: true })
  requesterArea!: string | null;

  @Column({ name: 'opened_by_td', type: 'boolean', default: false })
  openedByTd!: boolean;

  @Column({ name: 'opened_on_behalf_of', type: 'text', nullable: true })
  openedOnBehalfOf!: string | null;

  @Column({ name: 'behalf_reason', type: 'text', nullable: true })
  behalfReason!: string | null;

  @Column({ type: 'varchar', length: 50 })
  category!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategory!: string | null;

  @Column({ name: 'equipment_id', type: 'varchar', length: 50, nullable: true })
  equipmentId!: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 20 })
  impact!: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  priority!: string | null;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @Column({ type: 'text', nullable: true })
  diagnosis!: string | null;

  @Column({ type: 'text', nullable: true })
  solution!: string | null;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes!: string | null;

  @Column({ name: 'problem_status', type: 'varchar', length: 30, nullable: true })
  problemStatus!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'abierto' })
  status!: string;

  @Column({ name: 'times_reopened', type: 'int', default: 0 })
  timesReopened!: number;

  @Column({ name: 'escalated_to', type: 'uuid', nullable: true })
  escalatedTo!: string | null;

  @Column({ name: 'escalation_reason', type: 'text', nullable: true })
  escalationReason!: string | null;

  @Column({ name: 'collaborator_confirmation', type: 'varchar', length: 20, default: 'pendiente' })
  collaboratorConfirmation!: string;

  @Column({ name: 'sla_response_met', type: 'boolean', nullable: true })
  slaResponseMet!: boolean | null;

  @Column({ name: 'sla_resolution_met', type: 'boolean', nullable: true })
  slaResolutionMet!: boolean | null;

  @Column({ name: 'resolution_hours', type: 'decimal', precision: 8, scale: 2, nullable: true })
  resolutionHours!: string | null;

  @CreateDateColumn({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ name: 'first_response_at', type: 'timestamptz', nullable: true })
  firstResponseAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ name: 'estimated_delivery', type: 'timestamptz', nullable: true })
  estimatedDelivery!: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'WEB_COLLABORATOR' })
  origin!: string;

  @Column({ name: 'is_historical', type: 'boolean', default: false })
  isHistorical!: boolean;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;
}
