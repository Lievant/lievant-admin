import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'divisions', schema: 'catalogs' })
export class CatalogDivision extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'company_code', type: 'varchar', length: 50, nullable: true })
  companyCode!: string | null;
}
