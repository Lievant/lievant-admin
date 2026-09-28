import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AccountPasswordStatus = 'activa' | 'revocada' | 'vencida';

/**
 * Registro TIC-RE-17. La contraseña cifrada lleva `select: false`: ningún
 * find() la trae por accidente. Se escribe y se descifra solo con SQL explícito
 * en PasswordsService.
 */
@Entity({ name: 'account_passwords', schema: 'passwords' })
export class AccountPassword {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'record_number', type: 'int', insert: false, update: false })
  recordNumber!: number;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'manager_id', type: 'uuid' })
  managerId!: string;

  @Column({ type: 'varchar', length: 500 })
  username!: string;

  @Column({ name: 'password_encrypted', type: 'bytea', select: false })
  passwordEncrypted!: Buffer;

  @Column({ name: 'assigned_date', type: 'date' })
  assignedDate!: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'activa' })
  status!: AccountPasswordStatus;

  @Column({ name: 'expiry_notified_at', type: 'timestamptz', nullable: true })
  expiryNotifiedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
