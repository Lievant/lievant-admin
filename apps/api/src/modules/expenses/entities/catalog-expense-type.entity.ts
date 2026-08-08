import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from '../../catalogs/entities/catalog-base.entity';

/** Viáticos cliente, Costo operativo, Costo de Marketing… */
@Entity({ name: 'expense_types', schema: 'catalogs' })
export class CatalogExpenseType extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;
}
