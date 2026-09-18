import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo editable de categorías de herramientas.
 *
 * Va como tabla propia en `catalogs` porque este proyecto no tiene el par
 * catalog_types/catalog_items: el schema usa una tabla por catálogo con la
 * forma de CatalogBaseEntity (areas, divisions, locations, equipment_brands…),
 * y montar un motor genérico en paralelo dejaría dos arquitecturas de catálogo
 * compitiendo. Así la pantalla /admin/catalogos la administra sin código nuevo.
 *
 * Se siembra con las mismas categorías que traía hardcodeadas el módulo de
 * herramientas, más 'ERP / Contabilidad', para que las filas ya capturadas
 * sigan resolviendo contra el catálogo.
 */
export class CreateToolCategoriesCatalog1751000000022 implements MigrationInterface {
  name = 'CreateToolCategoriesCatalog1751000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS catalogs.tool_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        sort_order SMALLINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO catalogs.tool_categories (name, is_active, sort_order) VALUES
        ('Correo', true, 1),
        ('Suite Ofimática', true, 2),
        ('CRM', true, 3),
        ('Firma Digital', true, 4),
        ('Inteligencia Artificial', true, 5),
        ('Gestión de Proyectos', true, 6),
        ('Comunicación', true, 7),
        ('Diseño', true, 8),
        ('Seguridad', true, 9),
        ('ERP / Contabilidad', true, 10),
        ('Otro', true, 11)
      ON CONFLICT (name) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.tool_categories`);
  }
}
