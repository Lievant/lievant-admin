import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'project_documents', schema: 'projects' })
export class ProjectDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 100 })
  type!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 's3_key', type: 'varchar', length: 500 })
  s3Key!: string;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize!: number | null;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
