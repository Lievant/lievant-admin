import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Office } from './office.entity';

export enum AdminScope {
  GLOBAL = 'global',
  OFFICE = 'office',
}

@Entity({ schema: 'rooms', name: 'office_admins' })
export class OfficeAdmin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'office_id', type: 'uuid', nullable: true })
  officeId!: string | null;

  @ManyToOne(() => Office, (office) => office.admins, { nullable: true })
  @JoinColumn({ name: 'office_id' })
  office!: Office | null;

  @Column({ type: 'varchar', length: 10, default: AdminScope.OFFICE })
  scope!: AdminScope;

  @Column({ name: 'granted_by', type: 'uuid' })
  grantedBy!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by' })
  grantedByUser!: User;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;
}
