import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeRecord } from './employee-record.entity';

@Entity({ name: 'personal_data', schema: 'employees' })
export class PersonalData {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid', unique: true })
  employeeId!: string;

  @OneToOne(() => EmployeeRecord)
  @JoinColumn({ name: 'employee_id' })
  employee!: EmployeeRecord;

  @Column({ type: 'varchar', length: 13, nullable: true })
  rfc!: string | null;

  @Column({ name: 'imss_number', type: 'varchar', length: 20, nullable: true })
  imssNumber!: string | null;

  @Column({ type: 'varchar', length: 18, nullable: true })
  curp!: string | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate!: string | null;

  @Column({ name: 'blood_type', type: 'varchar', length: 5, nullable: true })
  bloodType!: string | null;

  @Column({ name: 'marital_status', type: 'varchar', length: 30, nullable: true })
  maritalStatus!: string | null;

  @Column({ type: 'smallint', default: 0 })
  children!: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  street!: string | null;

  @Column({ name: 'ext_number', type: 'varchar', length: 20, nullable: true })
  extNumber!: string | null;

  @Column({ name: 'int_number', type: 'varchar', length: 20, nullable: true })
  intNumber!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  neighborhood!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 10, nullable: true })
  postalCode!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state!: string | null;

  @Column({ name: 'main_transport', type: 'varchar', length: 100, nullable: true })
  mainTransport!: string | null;

  @Column({ name: 'commute_time', type: 'varchar', length: 50, nullable: true })
  commuteTime!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
