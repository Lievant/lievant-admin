import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Los numeric de Postgres llegan como string; se exponen como número. */
const numeric = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity({ name: 'risks', schema: 'sgsi' })
export class Risk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ type: 'varchar', length: 300 })
  threat!: string;

  @Column({ type: 'varchar', length: 300 })
  vulnerability!: string;

  @Column({ name: 'affected_asset', type: 'varchar', length: 200 })
  affectedAsset!: string;

  @Column({ type: 'text' })
  risk!: string;

  @Column({ name: 'vulnerability_score', type: 'smallint' })
  vulnerabilityScore!: number;

  @Column({ name: 'severity_score', type: 'smallint' })
  severityScore!: number;

  @Column({ name: 'probability_score', type: 'smallint' })
  probabilityScore!: number;

  /** Calculado por el servicio; nunca viene del cliente. */
  @Column({ name: 'risk_value', type: 'smallint' })
  riskValue!: number;

  @Column({ type: 'text' })
  control!: string;

  @Column({ name: 'control_efficacy', type: 'numeric', precision: 2, scale: 1, transformer: numeric })
  controlEfficacy!: number;

  /** Calculado por el servicio; nunca viene del cliente. */
  @Column({ name: 'residual_risk', type: 'numeric', precision: 5, scale: 2, transformer: numeric })
  residualRisk!: number;

  @Column({ name: 'reported_at', type: 'date', nullable: true })
  reportedAt!: string | null;

  @Column({ name: 'mitigation_strategy', type: 'text', nullable: true })
  mitigationStrategy!: string | null;

  @Column({ type: 'text', nullable: true })
  actions!: string | null;

  @Column({ name: 'estimated_resolution_date', type: 'date', nullable: true })
  estimatedResolutionDate!: string | null;

  /** Dueño: usuario de la plataforma (referencia) y copia de su nombre al asignarlo. */
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ type: 'varchar', length: 200 })
  owner!: string;

  @Column({ name: 'action_status', type: 'varchar', length: 20 })
  actionStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  // Columna simple, no @DeleteDateColumn: la baja es lógica y la consulta
  // filtra explícitamente.
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;
}
