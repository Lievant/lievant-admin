import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'vendor_categories', schema: 'catalogs' })
export class CatalogVendorCategory extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name!: string;
}
