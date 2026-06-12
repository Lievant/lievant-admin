import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'marital_statuses', schema: 'catalogs' })
export class CatalogMaritalStatus extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;
}
