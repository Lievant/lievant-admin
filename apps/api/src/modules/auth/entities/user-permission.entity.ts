import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { User } from './user.entity';

@Entity({ name: 'user_permissions', schema: 'auth' })
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @Column({ type: 'boolean', default: true })
  granted!: boolean;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'NOW()' })
  grantedAt!: Date;

  @ManyToOne(() => User, (u) => u.userPermissions)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}
