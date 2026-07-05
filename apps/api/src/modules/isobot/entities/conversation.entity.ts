import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'conversations', schema: 'isobot' })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 200, nullable: true })
  userName!: string | null;

  @Column({ name: 'user_area', type: 'varchar', length: 100, nullable: true })
  userArea!: string | null;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'last_message_at', type: 'timestamptz' })
  lastMessageAt!: Date;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount!: number;
}
