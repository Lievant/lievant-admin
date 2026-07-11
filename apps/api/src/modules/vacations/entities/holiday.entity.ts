import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'holidays', schema: 'catalogs' })
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'is_recurring', type: 'boolean', default: true })
  isRecurring!: boolean;

  @Column({ type: 'varchar', length: 3, default: 'MEX' })
  country!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
