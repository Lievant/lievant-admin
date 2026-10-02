import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Equipment } from './equipment.entity';

/** Tipo de mantenimiento. Solo el preventivo reinicia el reloj de 6 meses (RN-1). */
export type MaintenanceType = 'Preventivo' | 'Correctivo';

@Entity({ name: 'equipment_maintenance', schema: 'inventory' })
export class EquipmentMaintenance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId!: string;

  @ManyToOne(() => Equipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Equipment;

  @Column({ name: 'maintenance_date', type: 'date' })
  maintenanceDate!: string;

  @Column({ name: 'maintenance_type', type: 'varchar', length: 20, default: 'Preventivo' })
  maintenanceType!: MaintenanceType;

  // FK al catálogo de técnicos; nullable porque un técnico borrado del catálogo
  // no debe romper el registro histórico (el nombre queda copiado en technician_name).
  @Column({ name: 'technician_id', type: 'uuid', nullable: true })
  technicianId!: string | null;

  // Copia del nombre al momento de registrar: el histórico debe sobrevivir a que
  // den de baja al técnico del catálogo (mismo patrón que equipment_history.changed_by_name).
  @Column({ name: 'technician_name', type: 'varchar', length: 200 })
  technicianName!: string;

  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy!: string | null;
}
