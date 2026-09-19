import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

/**
 * Categorías de herramientas TI.
 *
 * Es una tabla propia, como el resto del schema `catalogs`: este proyecto no
 * tiene el par catalog_types/catalog_items, usa una tabla por catálogo con la
 * forma de CatalogBaseEntity.
 */
@Entity({ name: 'tool_categories', schema: 'catalogs' })
export class CatalogToolCategory extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;
}
