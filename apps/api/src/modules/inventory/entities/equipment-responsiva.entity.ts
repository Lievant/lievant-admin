import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from '../../employees/entities/employee-record.entity';

/**
 * Carta responsiva TIC-RE-02 de un colaborador. Una por persona: el folio
 * ampara todos sus equipos, que se detallan en la bitácora TIC-RE-10.
 */
@Entity({ name: 'equipment_responsivas', schema: 'inventory' })
export class EquipmentResponsiva {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => EmployeeRecord, { nullable: false, eager: false })
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ name: 'generated_at', type: 'timestamptz', nullable: true })
  generatedAt!: Date | null;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generatedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
