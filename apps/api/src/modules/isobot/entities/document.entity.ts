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

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  // Columna simple, no @DeleteDateColumn: los documentos retirados deben seguir
  // siendo visibles para el panel de administración, y @DeleteDateColumn los
  // ocultaría en todos los find() del módulo.
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
