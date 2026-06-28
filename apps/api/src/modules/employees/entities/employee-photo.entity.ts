import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeRecord } from './employee-record.entity';

@Entity({ name: 'employee_photos', schema: 'employees' })
export class EmployeePhoto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ name: 's3_key', type: 'varchar', length: 500 })
  s3Key!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize!: number;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ name: 'is_profile', type: 'boolean', default: false })
  isProfile!: boolean;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @Column({ name: 'uploaded_at', type: 'timestamptz', default: () => 'NOW()' })
  uploadedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
