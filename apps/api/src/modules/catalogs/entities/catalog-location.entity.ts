import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'locations', schema: 'catalogs' })
export class CatalogLocation extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 100, default: 'México' })
  country!: string;
}
