import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { IsobotDocument } from './document.entity';

/**
 * La columna `embedding vector(1536)` no se mapea aquí: TypeORM no tiene
 * soporte nativo para el tipo `vector` de pgvector. Se lee/escribe siempre
 * vía SQL crudo (ver IsobotService.search / indexChunk).
 */
@Entity({ name: 'document_chunks', schema: 'isobot' })
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => IsobotDocument)
  @JoinColumn({ name: 'document_id' })
  document!: IsobotDocument;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'token_count', type: 'int', nullable: true })
  tokenCount!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
