import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'subcategories', schema: 'helpdesk' })
export class HelpdeskSubcategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_slug', type: 'varchar', length: 50 })
  categorySlug!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
