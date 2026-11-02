import { Column, DeleteDateColumn, Entity } from 'typeorm';
import { CatalogBaseEntity } from './catalog-base.entity';

/** Competencia. `deletedAt` es el borrado lógico: TypeORM excluye las eliminadas de `find` salvo `withDeleted`. */
@Entity({ name: 'competencies', schema: 'catalogs' })
export class CatalogCompetency extends CatalogBaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
