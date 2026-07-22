import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'categories', schema: 'helpdesk' })
export class HelpdeskCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug!: string;

  @Column({ name: 'priority_base', type: 'varchar', length: 5, nullable: true })
  priorityBase!: string | null;

  @Column({ name: 'sla_response_hours', type: 'int', nullable: true })
  slaResponseHours!: number | null;

  @Column({ name: 'sla_resolution_hours', type: 'int', nullable: true })
  slaResolutionHours!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
