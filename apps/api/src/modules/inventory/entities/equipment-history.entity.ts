import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { Equipment } from './equipment.entity';

@Entity({ name: 'equipment_history', schema: 'inventory' })
export class EquipmentHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'equipment_id', type: 'uuid' })
  equipmentId!: string;

  @ManyToOne(() => Equipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipment_id' })
  equipment!: Equipment;

  @Column({ name: 'changed_by_id', type: 'uuid', nullable: true })
  changedById!: string | null;

  @Column({ name: 'changed_by_name', type: 'varchar', length: 200 })
  changedByName!: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ name: 'field_changed', type: 'varchar', length: 100, nullable: true })
  fieldChanged!: string | null;

  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue!: string | null;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
