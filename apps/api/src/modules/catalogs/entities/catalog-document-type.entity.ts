import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

@Entity({ name: 'document_types', schema: 'catalogs' })
export class CatalogDocumentType extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ name: 'applies_to', type: 'varchar', length: 20, default: 'client' })
  appliesTo!: string;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired!: boolean;
}
