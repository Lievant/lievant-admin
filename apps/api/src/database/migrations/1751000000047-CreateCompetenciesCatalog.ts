import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo de Competencias (Configuración › Catálogos).
 *
 * `catalogs.competencies`: nombre, descripción opcional, activo, orden y borrado lógico (`deleted_at`). El nombre es
 * único entre las no eliminadas, sin distinguir mayúsculas (índice parcial), así que una eliminada se puede recrear.
 * Sin datos semilla: las competencias entran por la carga desde Excel. Nada la liga todavía a otros módulos.
 *
 * Aditiva e idempotente; `down()` quita los índices y la tabla.
 */
export class CreateCompetenciesCatalog1751000000047 implements MigrationInterface {
  name = 'CreateCompetenciesCatalog1751000000047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS catalogs.competencies (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(150) NOT NULL,
        description TEXT NULL,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        sort_order  SMALLINT NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_competencies_name
      ON catalogs.competencies (lower(btrim(name))) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_catalog_competencies_active ON catalogs.competencies (is_active)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS catalogs.idx_catalog_competencies_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS catalogs.uq_catalog_competencies_name`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.competencies`);
  }
}
