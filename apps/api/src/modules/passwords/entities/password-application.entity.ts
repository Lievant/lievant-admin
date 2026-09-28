import { Column, Entity } from 'typeorm';
import { CatalogBaseEntity } from '../../catalogs/entities/catalog-base.entity';

/**
 * Catálogo homologado de aplicaciones para TIC-RE-17.
 *
 * Extiende la base de catálogos para que /admin/catalogos lo gestione con el
 * mismo CRUD genérico que el resto; vive en el schema `passwords` porque solo
 * lo consume este módulo.
 */
@Entity({ name: 'applications', schema: 'passwords' })
export class PasswordApplication extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 200, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl!: string | null;
}
