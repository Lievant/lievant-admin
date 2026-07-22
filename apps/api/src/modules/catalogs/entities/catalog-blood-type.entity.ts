import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'blood_types', schema: 'catalogs' })
export class CatalogBloodType extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 5, unique: true })
  name!: string;
}
