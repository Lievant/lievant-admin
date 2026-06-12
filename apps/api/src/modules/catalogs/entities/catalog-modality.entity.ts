import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'modalities', schema: 'catalogs' })
export class CatalogModality extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  name!: string;
}
