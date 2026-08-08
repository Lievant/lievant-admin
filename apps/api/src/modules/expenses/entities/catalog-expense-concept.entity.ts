import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from '../../catalogs/entities/catalog-base.entity';

/** Transporte, Alimentación, Hospedaje… Una tabla por catálogo, como el resto. */
@Entity({ name: 'expense_concepts', schema: 'catalogs' })
export class CatalogExpenseConcept extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;
}
