import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'project_business_units', schema: 'projects' })
export class ProjectBusinessUnit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'business_unit', type: 'varchar', length: 50 })
  businessUnit!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
