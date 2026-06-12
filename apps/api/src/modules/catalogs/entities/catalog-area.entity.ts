import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'areas', schema: 'catalogs' })
export class CatalogArea extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'division_name', type: 'varchar', length: 100, nullable: true })
  divisionName!: string | null;

  @Column({ name: 'company_code', type: 'varchar', length: 100, nullable: true })
  companyCode!: string | null;
}
