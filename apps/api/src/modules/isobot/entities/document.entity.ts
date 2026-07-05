import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'documents', schema: 'isobot' })
export class IsobotDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 300 })
  fileName!: string;

  @Column({ name: 's3_key', type: 'varchar', length: 500, nullable: true })
  s3Key!: string | null;

  @Column({ name: 'file_type', type: 'varchar', length: 20, nullable: true })
  fileType!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  macroprocess!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
