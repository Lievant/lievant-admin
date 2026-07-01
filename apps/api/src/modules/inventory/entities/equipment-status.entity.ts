import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'equipment_statuses', schema: 'inventory' })
export class EquipmentStatus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'gray' })
  color!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
