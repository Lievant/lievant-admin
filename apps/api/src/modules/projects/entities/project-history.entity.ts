import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'project_history', schema: 'projects' })
export class ProjectHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

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
