import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { DocumentStatus } from '../constants/document-status.constant';
import { ClientRecord } from './client-record.entity';

@Entity({ name: 'documents', schema: 'clients' })
export class ClientDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'client_record_id', type: 'uuid' })
  clientRecordId!: string;

  @ManyToOne(() => ClientRecord)
  @JoinColumn({ name: 'client_record_id' })
  clientRecord!: ClientRecord;

  @Column({ name: 'document_type', type: 'varchar', length: 100 })
  documentType!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 300 })
  fileName!: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ type: 'varchar', length: 20, default: DocumentStatus.UPLOADED })
  status!: DocumentStatus;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedByUser!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
